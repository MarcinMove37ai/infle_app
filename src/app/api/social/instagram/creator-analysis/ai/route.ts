// src/app/api/social/instagram/creator-analysis/ai/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { saveAIAnalysis, getAIAnalysis } from '@/lib/profileStorage';

// PROMPT bez zmian - pozostaje taki sam
const CREATOR_ANALYSIS_PROMPT = `Jesteś ekspertem w analizie treści i personal brandingu. Na podstawie dostarczonych postów wygeneruj JSON, który bezpośrednio zasili komponent React CreatorAnalysisIG.

## DANE WEJŚCIOWE
<context>
{CONTEXT_PLACEHOLDER}
</context>

## METODOLOGIA
1. **Analiza tematyczna** - zidentyfikuj główne obszary eksperckie
2. **Analiza stylu** - określ sposób komunikacji i ton
3. **Identyfikacja odbiorców** - na podstawie języka i treści
4. **Odkrycie ukrytego talentu** - znajdź nieoczywiste połączenie umiejętności

## WYMAGANA STRUKTURA JSON

\`\`\`json
{
  "username": "nazwa_bez_@",
  "profileDescription": "opis_300-800_słów",
  "competencies": [
    {
      "name": "nazwa_2-4_słowa",
      "iconType": "nazwa_ikony_z_listy",
      "description": "opis_100-300_słów",
      "evidence": ["dowód1", "dowód2", "dowód3"]
    }
  ],
  "uniqueTalent": {
    "name": "nazwa_talentu_2-4_słowa",
    "description": "konkretny_opis_50-100_słów",
    "marketValue": "wartość_rynkowa_30-50_słów",
    "evidence": ["dowód1", "dowód2"]
  }
}
\`\`\`

## SPECYFIKACJA PÓL

### profileDescription (300-800 słów)
- Rozpocznij: "Przeanalizowałem Twój profil i widzę, że..."
- Minimum 2 konkretne przykłady z postów
- Opisz styl komunikacji i podejście
- Zidentyfikuj target audience
- Wskaż unikalne cechy
- Ton: ciepły, personalny, motywujący

### competencies (dokładnie 3 elementy)

**name**: Unikalna nazwa kompetencji (2-4 słowa)
- ❌ "Ekspert Marketingu"
- ✅ "Tłumacz Algorytmów"
- ✅ "Mistrz Praktycznych Rozwiązań"
- ✅ "Wizjoner Automatyzacji"

**iconType**: Wybierz DOKŁADNIE z tej listy:
- "BrainCircuit" - wiedza techniczna, analityka
- "TrendingUp" - wzrost, strategia, trendy
- "MessageSquareQuote" - komunikacja, edukacja
- "Lightbulb" - innowacje, pomysły
- "Target" - precyzja, cele
- "Users" - społeczność, relacje
- "BookOpen" - wiedza, nauka
- "Zap" - energia, skuteczność
- "Heart" - empatia, wartości
- "Shield" - bezpieczeństwo, zaufanie

**description**: (100-300 słów)
- Dlaczego to jest jego mocna strona
- Konkretne przykłady z postów
- Jak wpływa na odbiorców
- Unikalność podejścia

**evidence**: (2-5 elementów)
- Konkretne przykłady z postów
- Typy treści potwierdzające
- Wzorce komunikacji
- Reakcje odbiorców

### uniqueTalent (NOWA SEKCJA)

**name**: (2-4 słowa) - konkretna nazwa talentu (np. "Psycholog Marketingu")
**description**: (50-100 słów) - konkretny opis JAK łączy 2-3 umiejętności
**marketValue**: (30-50 słów) - dlaczego to przynosi przewagę konkurencyjną
**evidence**: (2-3 elementy) - konkretne przykłady z postów

## INSTRUKCJA dla uniqueTalent

Zidentyfikuj UKRYTY TALENT - nieoczywiste połączenie 2-3 umiejętności:

**CELE:**
- Znajdź nieoczywiste połączenie kompetencji, które czyni go wyjątkowym
- Nazwa musi być konkretna i chwytliwa (jak "Psycholog Marketingu")
- Opis krótki, faktyczny, pokazuje JAK łączy umiejętności
- MarketValue: dlaczego to przynosi przewagę konkurencyjną
- Evidence: konkretne przykłady z postów potwierdzające ten talent

**PRZYKŁADY DOBRYCH TALENTÓW:**
✅ "Psycholog Marketingu" - łączy strategie sprzedażowe z psychologią konsumenta
✅ "Tłumacz Technologii" - przekłada tech trends na konkretne zyski biznesowe
✅ "Architekt Wolności" - łączy analizę finansową z life designem

## ZASADY JAKOŚCI

### KONKRETNOŚĆ
- Każde stwierdzenie poparte przykładem z postów
- Cytuj fragmenty lub opisuj konkretne treści
- Unikaj ogólników i pustych frazesów

### UNIKALNOŚĆ
- Każda kompetencja musi być różna
- Ukryty talent musi być naprawdę nieoczywisty i wyróżniający
- Nie używaj standardowych opisów

### DOWODY
- Minimum 2 konkretne przykłady w profileDescription
- Każda kompetencja poparta 2-5 dowodami
- Talent poparty 2-3 konkretnymi dowodami z postów

## PRZYKŁADY

### Dobry profileDescription:
"Przeanalizowałem Twój profil i widzę, że jesteś ekspertem automatyzacji, który w wyjątkowy sposób łączy zaawansowaną wiedzę techniczną z potrzebami małych firm. W poście z 15 marca pokazujesz implementację CRM w 5-osobowej firmie z konkretnymi kosztami i ROI. W innym materiale tłumaczysz API w sposób zrozumiały dla właścicieli sklepów..."

### Dobre nazwy kompetencji:
✅ "Tłumacz Technologii"
✅ "Mistrz Case Studies"
✅ "Guru Praktycznych Rozwiązań"

### Dobry uniqueTalent:
Przykład struktury:
- name: "Psycholog Marketingu"
- description: "Łączysz wiedzę o strategiach sprzedażowych z głębokim zrozumieniem psychologii konsumenta. Potrafisz pokazać nie tylko 'co robić', ale 'dlaczego ludzie tak reagują'."
- marketValue: "Tworzysz kampanie, które rzeczywiście motywują do działania, bo rozumiesz ludzką naturę."
- evidence: ["Post o psychologii kolorów w reklamach", "Analiza dlaczego konkretna kampania zadziałała"]

CRITICAL: Return ONLY valid JSON. No explanations, no comments, no text before or after. Start directly with { and end with }.`;

// Interface dla request body
interface AnalysisRequest {
  username: string;
}

// Interface dla odpowiedzi AI
interface AIAnalysisResponse {
  username: string;
  profileDescription: string;
  competencies: Array<{
    name: string;
    iconType: string;
    description: string;
    evidence: string[];
  }>;
  uniqueTalent: {
    name: string;
    description: string;
    marketValue: string;
    evidence: string[];
  };
}

/**
 * Ekstraktuje i parsuje JSON z odpowiedzi Claude 4
 * Claude 4 może zwracać JSON otoczony dodatkowym tekstem
 */
function extractAndParseJSON(aiResponse: string): any {
  console.log('🔍 Raw AI response length:', aiResponse.length);
  console.log('🔍 First 300 chars:', aiResponse.substring(0, 300));
  console.log('🔍 Last 300 chars:', aiResponse.substring(aiResponse.length - 300));

  // Metoda 1: Spróbuj bezpośrednio
  try {
    const trimmed = aiResponse.trim();
    const parsed = JSON.parse(trimmed);
    console.log('✅ Direct JSON parse successful');
    return parsed;
  } catch (error) {
    console.log('📝 Direct JSON parse failed, trying extraction...');
  }

  // Metoda 2: Znajdź JSON w tekście używając różnych wzorców
  const jsonPatterns = [
    // Wzorzec 1: ```json ... ```
    /```json\s*(\{[\s\S]*?\})\s*```/,
    // Wzorzec 2: ``` ... ``` (bez 'json')
    /```\s*(\{[\s\S]*?\})\s*```/,
    // Wzorzec 3: Pierwszy pełny obiekt JSON { ... }
    /(\{[\s\S]*\})/,
    // Wzorzec 4: JSON między nowymi liniami
    /\n(\{[\s\S]*?\})\n/
  ];

  for (let i = 0; i < jsonPatterns.length; i++) {
    const pattern = jsonPatterns[i];
    const match = aiResponse.match(pattern);

    if (match && match[1]) {
      console.log(`🎯 JSON found using pattern ${i + 1}`);
      console.log('🔍 Extracted JSON preview:', match[1].substring(0, 200) + '...');

      try {
        const parsed = JSON.parse(match[1].trim());
        console.log(`✅ Pattern ${i + 1} parse successful`);
        return parsed;
      } catch (error) {
        console.log(`❌ Pattern ${i + 1} failed to parse:`, error);
        continue;
      }
    }
  }

  // Metoda 3: Znajdź najbardziej prawdopodobny JSON
  // Szukaj pierwszego { i ostatniego } z odpowiednim zagnieżdżeniem
  let firstBrace = aiResponse.indexOf('{');
  if (firstBrace === -1) {
    throw new Error('No opening brace found in response');
  }

  let braceCount = 0;
  let lastBrace = -1;

  for (let i = firstBrace; i < aiResponse.length; i++) {
    if (aiResponse[i] === '{') {
      braceCount++;
    } else if (aiResponse[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        lastBrace = i;
        break;
      }
    }
  }

  if (lastBrace === -1) {
    throw new Error('No matching closing brace found in response');
  }

  const extractedJson = aiResponse.substring(firstBrace, lastBrace + 1);
  console.log('🎯 JSON extracted using brace matching');
  console.log('🔍 Extracted length:', extractedJson.length);

  try {
    const parsed = JSON.parse(extractedJson);
    console.log('✅ Brace matching parse successful');
    return parsed;
  } catch (error) {
    console.error('❌ Final parsing attempt failed');
    console.error('🔍 Problematic JSON preview:', extractedJson.substring(0, 500));
    throw new Error(`JSON parsing failed: ${error instanceof Error ? error.message : 'Unknown parsing error'}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting creator analysis AI endpoint with database integration...');

    // 1. Sprawdź sesję użytkownika
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      console.log('❌ No valid session found');
      return NextResponse.json(
        { error: 'Unauthorized', details: 'You must be logged in to perform AI analysis' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    console.log('👤 User ID:', userId);

    // 2. Parse request body
    const body: AnalysisRequest = await request.json();
    const { username } = body;

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    console.log(`📊 Analyzing creator: @${username} for user: ${userId}`);

    // 3. Sprawdź czy już istnieje analiza w bazie danych (opcjonalne cache)
    const existingAnalysis = await getAIAnalysis(userId, username);
    if (existingAnalysis) {
      console.log('📄 Found existing AI analysis in database');

      // Sprawdź czy analiza nie jest za stara (np. starsze niż 7 dni)
      const analysis = await prisma.instagramCreatorAIAnalysis.findUnique({
        where: {
          userId_username: {
            userId: userId,
            username: username
          }
        }
      });

      if (analysis) {
        const daysSinceUpdate = (Date.now() - analysis.updatedAt.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceUpdate < 7) { // Jeśli analiza jest młodsza niż 7 dni
          console.log(`♻️ Using cached analysis (${daysSinceUpdate.toFixed(1)} days old)`);

          return NextResponse.json({
            success: true,
            username: username,
            postsAnalyzed: analysis.postsAnalyzed,
            analysis: existingAnalysis,
            metadata: {
              generatedAt: analysis.updatedAt.toISOString(),
              aiModel: analysis.aiModel,
              postsCount: analysis.postsAnalyzed,
              version: analysis.version,
              cached: true
            }
          });
        }
      }
    }

    // 4. Fetch captions from database
    console.log('🔍 Fetching captions from database...');

    const posts = await prisma.instagramCreatorAnalysis.findMany({
      where: {
        username: username
      },
      select: {
        caption: true,
        postId: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50 // Limit to last 50 posts for performance
    });

    if (posts.length === 0) {
      return NextResponse.json(
        {
          error: 'No posts found for this username',
          details: `No data found in database for username: ${username}. Please run creator analysis first.`
        },
        { status: 404 }
      );
    }

    console.log(`🔍 Found ${posts.length} posts for analysis`);

    // 5. Format context for AI
    const context = posts
      .map((post, index) => `Caption ${index + 1}: "${post.caption}"`)
      .join('\n\n');

    console.log(`📋 Context prepared: ${context.length} characters`);

    // 6. Prepare prompt with context
    const fullPrompt = CREATOR_ANALYSIS_PROMPT.replace(
      '{CONTEXT_PLACEHOLDER}',
      context
    );

    // 7. Call Claude API
    console.log('🤖 Calling Claude Sonnet 4...');

    // Sprawdź czy API key istnieje
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        {
          error: 'API configuration error',
          details: 'ANTHROPIC_API_KEY not found in environment variables'
        },
        { status: 500 }
      );
    }

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', // Claude Sonnet 4
        max_tokens: 4000,
        temperature: 0.1, // ✨ ZMIENIONE: Niższa temperatura dla Claude 4
        system: 'You are a JSON API. Return only valid JSON without any explanations or formatting.', // ✨ POPRAWIONE: system jako oddzielny parametr
        messages: [
          {
            role: 'user',
            content: fullPrompt
          }
        ]
      })
    });

    if (!claudeResponse.ok) {
      const errorData = await claudeResponse.text();
      console.error('❌ Claude API error:', errorData);

      return NextResponse.json(
        {
          error: 'AI analysis failed',
          details: `Claude API returned ${claudeResponse.status}: ${errorData}`
        },
        { status: 500 }
      );
    }

    const claudeData = await claudeResponse.json();

    // ✨ NOWE: Lepszy error handling dla Claude 4
    console.log('🔍 Claude response structure:', JSON.stringify(claudeData, null, 2));

    // Sprawdź czy odpowiedź ma poprawną strukturę
    if (!claudeData.content || !claudeData.content[0]) {
      console.error('❌ Invalid Claude response structure:', claudeData);
      return NextResponse.json(
        {
          error: 'Invalid Claude response',
          details: 'Claude API returned malformed response structure',
          rawResponse: JSON.stringify(claudeData)
        },
        { status: 500 }
      );
    }

    // ✨ NOWE: Sprawdź Claude 4 refusal stop reason
    if (claudeData.stop_reason === 'refusal') {
      console.error('❌ Claude refused to generate content:', claudeData.content[0]?.text);
      return NextResponse.json(
        {
          error: 'Content generation refused',
          details: 'Claude declined to generate the requested analysis for safety reasons',
          refusalText: claudeData.content[0]?.text || 'No refusal text provided'
        },
        { status: 400 }
      );
    }

    // ✨ NOWE: Sprawdź czy content zawiera text
    if (!claudeData.content[0].text) {
      console.error('❌ No text content in Claude response:', claudeData.content[0]);
      return NextResponse.json(
        {
          error: 'Empty Claude response',
          details: 'Claude API returned response without text content',
          contentType: claudeData.content[0].type || 'unknown'
        },
        { status: 500 }
      );
    }

    const aiResponse = claudeData.content[0].text;
    console.log('✅ Claude response received');
    console.log('📝 Response length:', aiResponse.length);
    console.log('🔍 First 200 chars:', aiResponse.substring(0, 200));

    // 8. ✨ NOWE: Parse and validate JSON response with improved parser
    let analysisResult: AIAnalysisResponse;

    try {
      // ✨ UŻYWAMY NOWEJ FUNKCJI extractAndParseJSON
      analysisResult = extractAndParseJSON(aiResponse);
      console.log('✅ JSON parsed successfully');
      console.log('📊 Parsed structure:', {
        username: analysisResult.username,
        competenciesCount: analysisResult.competencies?.length,
        hasUniqueTalent: !!analysisResult.uniqueTalent,
        profileDescLength: analysisResult.profileDescription?.length
      });
    } catch (parseError) {
      console.error('❌ Failed to parse AI response as JSON:', parseError);
      console.error('🔍 Raw AI response sample:', aiResponse.substring(0, 1000) + '...');

      // Zapisz pełną odpowiedź do debugowania
      console.error('📝 Full raw response for debugging:', aiResponse);

      return NextResponse.json(
        {
          error: 'Invalid AI response format',
          details: `AI returned non-JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`,
          rawResponseSample: aiResponse.substring(0, 500) + '...',
          responseLength: aiResponse.length
        },
        { status: 500 }
      );
    }

    // 9. Walidacja z uniqueTalent
    if (!analysisResult.username || !analysisResult.profileDescription ||
        !analysisResult.competencies || !analysisResult.uniqueTalent) {
      console.error('❌ Invalid analysis structure:', analysisResult);

      return NextResponse.json(
        {
          error: 'Incomplete analysis',
          details: 'AI response missing required fields (uniqueTalent required)'
        },
        { status: 500 }
      );
    }

    if (analysisResult.competencies.length !== 3) {
      console.error('❌ Invalid competencies count:', analysisResult.competencies.length);

      return NextResponse.json(
        {
          error: 'Invalid competencies',
          details: 'Expected exactly 3 competencies'
        },
        { status: 500 }
      );
    }

    // Walidacja uniqueTalent
    if (!analysisResult.uniqueTalent.name || !analysisResult.uniqueTalent.description ||
        !analysisResult.uniqueTalent.marketValue) {
      console.error('❌ Invalid uniqueTalent structure:', analysisResult.uniqueTalent);

      return NextResponse.json(
        {
          error: 'Invalid uniqueTalent',
          details: 'uniqueTalent must have name, description, and marketValue'
        },
        { status: 500 }
      );
    }

    // 10. 🆕 ZAPISZ DO BAZY DANYCH
    console.log('💾 Saving AI analysis to database...');

    const currentTime = new Date().toISOString();
    const metadata = {
      generatedAt: currentTime,
      aiModel: 'claude-sonnet-4-20250514', // ✨ ZAKTUALIZOWANE
      postsCount: posts.length,
      version: '2.1-uniqueTalent-claude4' // ✨ ZAKTUALIZOWANE
    };

    const saveResult = await saveAIAnalysis({
      userId: userId,
      username: username,
      analysisData: analysisResult,
      metadata: metadata,
      postsAnalyzed: posts.length
    });

    if (!saveResult.success) {
      console.error('❌ Failed to save AI analysis to database:', saveResult.error);
      // Nie blokujemy odpowiedzi - log error ale kontynuuj
    } else {
      console.log('✅ AI analysis saved to database with ID:', saveResult.analysisId);
    }

    // 11. Success response
    console.log(`✅ Analysis completed successfully for @${username}`);
    console.log(`📊 Generated: ${analysisResult.competencies.length} competencies, uniqueTalent: ${analysisResult.uniqueTalent.name}`);
    console.log(`🎯 Talent: ${analysisResult.uniqueTalent.name} - ${analysisResult.uniqueTalent.marketValue}`);
    console.log(`💾 Database save: ${saveResult.success ? 'SUCCESS' : 'FAILED'}`);

    return NextResponse.json({
      success: true,
      username: username,
      postsAnalyzed: posts.length,
      analysis: analysisResult,
      metadata: {
        ...metadata,
        savedToDatabase: saveResult.success,
        analysisId: saveResult.analysisId
      }
    });

  } catch (error) {
    console.error('❌ Endpoint error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET method - zaktualizowany z informacjami o nowej funkcjonalności
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');

  if (!username) {
    return NextResponse.json({
      message: 'Creator Analysis AI Endpoint v2.1 with Claude 4 Support',
      description: 'Enhanced with uniqueTalent discovery, automatic database storage, and Claude 4 compatibility',
      usage: 'POST with {"username": "instagram_username"}',
      example: 'GET ?username=test_user for quick test',
      features: [
        'uniqueTalent instead of uniqueTrait',
        'marketValue field',
        'evidence for talents',
        'improved talent discovery',
        '🆕 Automatic database storage',
        '🆕 Smart caching (7 days)',
        '🆕 User session integration',
        '✨ Claude 4 compatibility',
        '✨ Improved JSON parsing',
        '✨ Better error handling'
      ],
      database: {
        table: 'instagram_creator_ai_analysis',
        strategy: 'upsert per userId+username',
        caching: '7 days auto-refresh',
        fields: ['profileDescription', 'competencies', 'uniqueTalent', 'metadata']
      }
    });
  }

  // Quick test - just show available data
  try {
    const posts = await prisma.instagramCreatorAnalysis.findMany({
      where: { username },
      select: {
        caption: true,
        postId: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    // Sprawdź czy istnieją zapisane analizy AI
    const aiAnalysisCount = await prisma.instagramCreatorAIAnalysis.count({
      where: { username }
    });

    return NextResponse.json({
      username,
      availablePosts: posts.length,
      samplePosts: posts.map(p => ({
        postId: p.postId,
        captionPreview: p.caption.substring(0, 100) + '...',
        createdAt: p.createdAt
      })),
      aiAnalysisCount: aiAnalysisCount,
      message: 'Use POST method to generate AI analysis with uniqueTalent discovery and auto-save',
      version: 'v2.1-uniqueTalent-claude4',
      databaseIntegration: {
        enabled: true,
        caching: '7 days',
        autoSave: true
      },
      claude4Support: {
        enabled: true,
        improvedParsing: true,
        betterErrorHandling: true
      }
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Database error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}