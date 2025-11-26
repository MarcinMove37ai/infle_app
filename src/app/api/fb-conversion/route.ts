// src/app/api/fb-conversion/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  FacebookAdsApi,
  ServerEvent,
  EventRequest,
  UserData,
  CustomData
} from 'facebook-nodejs-business-sdk';
import crypto from 'crypto';

// Konfiguracja (tylko ID, bez initu tokena tutaj)
const PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID!;

// Funkcja pomocnicza do haszowania (SHA256)
const hash = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

export async function POST(request: NextRequest) {
  try {
    // 1. Bezpieczne pobranie tokena (tylko w runtime, nie przy buildzie)
    const accessToken = process.env.FB_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error("Brak FB_ACCESS_TOKEN w zmiennych środowiskowych");
    }

    // 2. Inicjalizacja SDK
    FacebookAdsApi.init(accessToken);

    const body = await request.json();
    const { eventName, eventId, customData, userData: clientUserData } = body;

    // 3. Pobieranie danych z nagłówków (IP, User Agent, Cookies)
    const forwardedFor = request.headers.get('x-forwarded-for');
    const clientIp = forwardedFor ? forwardedFor.split(',')[0] : (request as any).ip || '0.0.0.0';
    const userAgent = request.headers.get('user-agent') || '';

    // Odczyt ciasteczek serwerowo (eliminuje Race Condition)
    const fbpCookie = request.cookies.get('_fbp')?.value || clientUserData?.fbp;
    const fbcCookie = request.cookies.get('_fbc')?.value || clientUserData?.fbc;

    // 4. Budowanie obiektu UserData
    const userDataObj = new UserData()
      .setClientIpAddress(clientIp)
      .setClientUserAgent(userAgent);

    if (fbpCookie) userDataObj.setFbp(fbpCookie);
    if (fbcCookie) userDataObj.setFbc(fbcCookie);

    // Normalizacja i haszowanie danych (Advanced Matching)
    if (clientUserData?.email) {
      const normalizedEmail = clientUserData.email.trim().toLowerCase();
      userDataObj.setEmails([hash(normalizedEmail)]);
    }

    if (clientUserData?.phone) {
      const normalizedPhone = clientUserData.phone.replace(/\D/g, '');
      userDataObj.setPhones([hash(normalizedPhone)]);
    }

    if (clientUserData?.firstName) userDataObj.setFirstNames([hash(clientUserData.firstName.trim().toLowerCase())]);
    if (clientUserData?.lastName) userDataObj.setLastNames([hash(clientUserData.lastName.trim().toLowerCase())]);
    if (clientUserData?.city) userDataObj.setCities([hash(clientUserData.city.trim().toLowerCase())]);
    if (clientUserData?.country) userDataObj.setCountries([hash(clientUserData.country.trim().toLowerCase())]);

    // 5. Budowanie CustomData
    const customDataObj = new CustomData();
    if (customData) {
      if (customData.currency) customDataObj.setCurrency(customData.currency);
      if (customData.value) customDataObj.setValue(customData.value);
      if (customData.content_name) customDataObj.setContentName(customData.content_name);
      if (customData.content_ids) customDataObj.setContentIds(customData.content_ids);
      if (customData.content_type) customDataObj.setContentType(customData.content_type);
      if (customData.status) customDataObj.setStatus(customData.status); // np. dla rejestracji

      // Własne parametry (source, plan itp.)
      if (customData.source) customDataObj.setCustomProperties({ source: customData.source });
      if (customData.plan_selected) customDataObj.setCustomProperties({ plan_selected: customData.plan_selected });
    }

    // 6. Tworzenie zdarzenia
    const serverEvent = new ServerEvent()
      .setEventName(eventName)
      .setEventTime(Math.floor(Date.now() / 1000))
      .setUserData(userDataObj)
      .setCustomData(customDataObj)
      .setActionSource('website');

    if (eventId) {
      serverEvent.setEventId(eventId);
    }

    // 7. Wysłanie do FB
    const eventsData = [serverEvent];
    const eventRequest = new EventRequest(accessToken, PIXEL_ID).setEvents(eventsData);

    if (body.testEventCode) {
        eventRequest.setTestEventCode(body.testEventCode);
    }

    const response = await eventRequest.execute();

    return NextResponse.json({
      success: true,
      id: response.events_received
    });

  } catch (error: any) {
    console.error('FB CAPI Error:', error.response ? error.response.data : error.message);
    // Zwracamy 200 z info o błędzie w ciele, żeby nie wywalać formularza na froncie
    return NextResponse.json(
      { success: false, error: 'Event processing failed' },
      { status: 200 }
    );
  }
}