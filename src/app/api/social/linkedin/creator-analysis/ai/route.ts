// src/app/api/social/linkedin/creator-analysis/ai/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// PROMPT IDENTYCZNY jak Instagram - bez zmian
const CREATOR_ANALYSIS_PROMPT = `Jesteś ekspertem w analizie treści i personal brandingu. Na podstawie dostarczonych postów wygeneruj JSON, który bezpośrednio zasili komponent React CreatorAnalysisLI.

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
  "businessCompetencies": [
    {
      "name": "nazwa_2-4_słowa",
      "iconType": "nazwa_ikony_z_listy",
      "description": "opis_100-300_słów",
      "evidence": ["dowód1", "dowód2", "dowód3"]
    }
  ],
  "expertiseNiche": {
    "name": "nazwa_niszy_2-4_słowa",
    "description": "konkretny_opis_50-100_słów",
    "marketValue": "wartość_rynkowa_30-50_słów",
    "evidence": ["dowód1", "dowód2"]
  }
}
\`\`\`

## SPECYFIKACJA PÓL

### profileDescription (300-800 słów)
- Rozpocznij: "Przeanalizowałem Twój profil LinkedIn i widzę, że..."
- Minimum 2 konkretne przykłady z postów
- Opisz styl komunikacji i podejście biznesowe
- Zidentyfikuj target audience (profesjonalny)
- Wskaż unikalne cechy w kontekście biznesowym
- Ton: profesjonalny, motywujący, ekspercki

### businessCompetencies (dokładnie 3 elementy)

**name**: Unikalna nazwa kompetencji biznesowej (2-4 słowa)
- ❌ "Ekspert Marketingu"
- ✅ "Architekt Strategii Cyfrowej"
- ✅ "Mentor Transformacji"
- ✅ "Navigator Innowacji"

**iconType**: Wybierz DOKŁADNIE z tej listy:
- "BrainCircuit" - wiedza techniczna, analityka
- "TrendingUp" - wzrost, strategia, trendy
- "MessageSquareQuote" - komunikacja, edukacja
- "Lightbulb" - innowacje, pomysły
- "Target" - precyzja, cele
- "Users" - społeczność, relacje, networking
- "BookOpen" - wiedza, nauka, eksperckość
- "Zap" - energia, skuteczność
- "Heart" - empatia, wartości, kultura
- "Shield" - bezpieczeństwo, zaufanie

**description**: (100-300 słów)
- Dlaczego to jest jego mocna strona w biznesie
- Konkretne przykłady z postów LinkedIn
- Jak wpływa na sieć zawodową
- Unikalność podejścia w kontekście biznesowym

**evidence**: (2-5 elementów)
- Konkretne przykłady z postów LinkedIn
- Typy treści biznesowych potwierdzające
- Wzorce komunikacji profesjonalnej
- Reakcje sieci zawodowej

### expertiseNiche (NOWA SEKCJA - LinkedIn specific)

**name**: (2-4 słowa) - konkretna nazwa niszy eksperckiej (np. "Strategia Digital Leadership")
**description**: (50-100 słów) - konkretny opis JAK łączy 2-3 umiejętności biznesowe
**marketValue**: (30-50 słów) - dlaczego to przynosi przewagę konkurencyjną w biznesie
**evidence**: (2-3 elementy) - konkretne przykłady z postów LinkedIn

## INSTRUKCJA dla expertiseNiche

Zidentyfikuj EKSPERCKĄ NISZĘ - nieoczywiste połączenie 2-3 umiejętności biznesowych:

**CELE:**
- Znajdź nieoczywiste połączenie kompetencji biznesowych, które czyni go wyjątkowym liderem
- Nazwa musi być konkretna i biznesowa (jak "Digital Transformation Leader")
- Opis krótki, faktyczny, pokazuje JAK łączy umiejętności w kontekście biznesowym
- MarketValue: dlaczego to przynosi przewagę w środowisku korporacyjnym/biznesowym
- Evidence: konkretne przykłady z postów LinkedIn potwierdzające tę niszę

**PRZYKŁADY DOBRYCH NISZ:**
✅ "Strategia Digital Leadership" - łączy transformację cyfrową z zarządzaniem zespołami
✅ "Innovation Catalyst" - przekłada trendy technologiczne na strategie biznesowe
✅ "Culture Architect" - łączy HR z business strategy i cultural transformation

## ZASADY JAKOŚCI

### KONKRETNOŚĆ
- Każde stwierdzenie poparte przykładem z postów LinkedIn
- Cytuj fragmenty lub opisuj konkretne treści biznesowe
- Unikaj ogólników i pustych frazesów korporacyjnych

### UNIKALNOŚĆ
- Każda kompetencja musi być różna i biznesowo ukierunkowana
- Eksperoka nisza musi być naprawdę nieoczywista i wyróżniająca w świecie biznesu
- Nie używaj standardowych opisów korporacyjnych

### DOWODY
- Minimum 2 konkretne przykłady w profileDescription z postów LinkedIn
- Każda kompetencja poparta 2-5 dowodami z treści biznesowych
- Nisza poparta 2-3 konkretnymi dowodami z postów LinkedIn

## PRZYKŁADY

### Dobry profileDescription:
"Przeanalizowałem Twój profil LinkedIn i widzę, że jesteś ekspertem digital transformation, który w wyjątkowy sposób łączy strategiczne myślenie z praktycznym podejściem do zmian organizacyjnych. W poście z 15 marca pokazujesz implementację agile w średniej firmie z konkretnymi metrykami ROI. W innym materiale analizujesz trendy AI w kontekście real-world aplikacji biznesowych..."

### Dobre nazwy kompetencji:
✅ "Strategia Digital Leadership"
✅ "Mentor Transformacji"
✅ "Navigator Innowacji"

### Dobra expertiseNiche:
Przykład struktury:
- name: "Innovation Catalyst"
- description: "Łączysz wiedzę o emerging technologies z głębokim zrozumieniem business operations. Potrafisz pokazać nie tylko 'co nowego', ale 'jak to praktycznie wdrożyć'."
- marketValue: "Tworzysz strategie innowacji, które rzeczywiście generują wyniki biznesowe, bo rozumiesz zarówno tech jak i operations."
- evidence: ["Post o AI implementation w manufacturing", "Analiza ROI z blockchain pilot project"]

Zwróć TYLKO poprawny JSON bez komentarzy.`;

// Interface dla request body
interface AnalysisRequest {
  username: string;
}

// Interface dla odpowiedzi AI - LinkedIn specific
interface LinkedInAIAnalysisResponse {
  username: string;
  profileDescription: string;
  businessCompetencies: Array<{
    name: string;
    iconType: string;
    description: string;
    evidence: string[];
  }>;
  expertiseNiche: {
    name: string;
    description: string;
    marketValue: string;
    evidence: string[];
  };
}

// Helper function to save LinkedIn AI analysis
async function saveLinkedInAIAnalysis({
  userId,
  username,
  analysisData,
  metadata,
  postsAnalyzed
}: {
  userId: string;
  username: string;
  analysisData: LinkedInAIAnalysisResponse;
  metadata: any;
  postsAnalyzed: number;
}) {
  try {
    console.log('💾 Saving LinkedIn AI analysis to database...');

    const result = await prisma.linkedInCreatorAIAnalysis.upsert({
      where: {
        userId_username: {
          userId: userId,
          username: username
        }
      },
      update: {
        profileDescription: analysisData.profileDescription,
        businessCompetencies: analysisData.businessCompetencies,
        expertiseNiche: analysisData.expertiseNiche,
        metadata: metadata,
        postsAnalyzed: postsAnalyzed,
        updatedAt: new Date()
      },
      create: {
        userId: userId,
        username: username,
        profileDescription: analysisData.profileDescription,
        businessCompetencies: analysisData.businessCompetencies,
        expertiseNiche: analysisData.expertiseNiche,
        metadata: metadata,
        postsAnalyzed: postsAnalyzed
      }
    });

    console.log('✅ LinkedIn AI analysis saved with ID:', result.id);

    return {
      success: true,
      analysisId: result.id
    };

  } catch (error) {
    console.error('❌ Error saving LinkedIn AI analysis:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown database error'
    };
  }
}

// Helper function to get existing LinkedIn AI analysis
async function getLinkedInAIAnalysis(userId: string, username: string) {
  try {
    const analysis = await prisma.linkedInCreatorAIAnalysis.findUnique({
      where: {
        userId_username: {
          userId: userId,
          username: username
        }
      }
    });

    if (!analysis) return null;

    return {
      username: analysis.username,
      profileDescription: analysis.profileDescription,
      businessCompetencies: analysis.businessCompetencies,
      expertiseNiche: analysis.expertiseNiche
    };

  } catch (error) {
    console.error('❌ Error fetching LinkedIn AI analysis:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting LinkedIn creator analysis AI endpoint with database integration...');

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

    console.log(`📊 Analyzing LinkedIn creator: ${username} for user: ${userId}`);

    // 3. Sprawdź czy już istnieje analiza w bazie danych (opcjonalne cache)
    const existingAnalysis = await getLinkedInAIAnalysis(userId, username);
    if (existingAnalysis) {
      console.log('🔄 Found existing LinkedIn AI analysis in database');

      // Sprawdź czy analiza nie jest za stara (np. starsze niż 7 dni)
      const analysis = await prisma.linkedInCreatorAIAnalysis.findUnique({
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
          console.log(`♻️ Using cached LinkedIn analysis (${daysSinceUpdate.toFixed(1)} days old)`);

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

    // 4. Fetch postText from database (LinkedIn specific)
    console.log('🔍 Fetching LinkedIn posts from database...');

    const posts = await prisma.linkedInCreatorAnalysis.findMany({
      where: {
        username: username
      },
      select: {
        postText: true,  // LinkedIn używa postText zamiast caption
        postUrn: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50 // Limit to last 50 posts for performance
    });

    if (posts.length === 0) {
      return NextResponse.json(
        {
          error: 'No LinkedIn posts found for this username',
          details: `No data found in database for username: ${username}. Please run LinkedIn creator analysis first.`
        },
        { status: 404 }
      );
    }

    console.log(`📝 Found ${posts.length} LinkedIn posts for analysis`);

    // 5. Format context for AI (using postText)
    const context = posts
      .map((post, index) => `Post ${index + 1}: "${post.postText}"`)
      .join('\n\n');

    console.log(`📋 Context prepared: ${context.length} characters`);

    // 6. Prepare prompt with context
    const fullPrompt = CREATOR_ANALYSIS_PROMPT.replace(
      '{CONTEXT_PLACEHOLDER}',
      context
    );

    // 7. Call Claude API
    console.log('🤖 Calling Claude Sonnet 4 for LinkedIn analysis...');

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
        model: 'claude-3-5-sonnet-20241022', // Claude Sonnet 4
        max_tokens: 4000,
        temperature: 0.3, // Niższa temperatura dla bardziej konsystentnych odpowiedzi
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
    const aiResponse = claudeData.content[0].text;

    console.log('✅ Claude response received for LinkedIn');

    // 8. Parse and validate JSON response
    let analysisResult: LinkedInAIAnalysisResponse;

    try {
      analysisResult = JSON.parse(aiResponse);
      console.log('✅ LinkedIn JSON parsed successfully');
    } catch (parseError) {
      console.error('❌ Failed to parse LinkedIn AI response as JSON:', parseError);
      console.error('Raw AI response:', aiResponse);

      return NextResponse.json(
        {
          error: 'Invalid AI response format',
          details: 'AI returned non-JSON response',
          rawResponse: aiResponse.substring(0, 500) + '...'
        },
        { status: 500 }
      );
    }

    // 9. Walidacja z expertiseNiche (LinkedIn specific)
    if (!analysisResult.username || !analysisResult.profileDescription ||
        !analysisResult.businessCompetencies || !analysisResult.expertiseNiche) {
      console.error('❌ Invalid LinkedIn analysis structure:', analysisResult);

      return NextResponse.json(
        {
          error: 'Incomplete LinkedIn analysis',
          details: 'AI response missing required fields (expertiseNiche required)'
        },
        { status: 500 }
      );
    }

    if (analysisResult.businessCompetencies.length !== 3) {
      console.error('❌ Invalid businessCompetencies count:', analysisResult.businessCompetencies.length);

      return NextResponse.json(
        {
          error: 'Invalid business competencies',
          details: 'Expected exactly 3 business competencies'
        },
        { status: 500 }
      );
    }

    // Walidacja expertiseNiche
    if (!analysisResult.expertiseNiche.name || !analysisResult.expertiseNiche.description ||
        !analysisResult.expertiseNiche.marketValue) {
      console.error('❌ Invalid expertiseNiche structure:', analysisResult.expertiseNiche);

      return NextResponse.json(
        {
          error: 'Invalid expertiseNiche',
          details: 'expertiseNiche must have name, description, and marketValue'
        },
        { status: 500 }
      );
    }

    // 10. 🆕 ZAPISZ DO BAZY DANYCH (LinkedIn specific)
    console.log('💾 Saving LinkedIn AI analysis to database...');

    const currentTime = new Date().toISOString();
    const metadata = {
      generatedAt: currentTime,
      aiModel: 'claude-3-5-sonnet-20241022',
      postsCount: posts.length,
      version: '2.0-linkedin'
    };

    const saveResult = await saveLinkedInAIAnalysis({
      userId: userId,
      username: username,
      analysisData: analysisResult,
      metadata: metadata,
      postsAnalyzed: posts.length
    });

    if (!saveResult.success) {
      console.error('❌ Failed to save LinkedIn AI analysis to database:', saveResult.error);
      // Nie blokujemy odpowiedzi - log error ale kontynuuj
    } else {
      console.log('✅ LinkedIn AI analysis saved to database with ID:', saveResult.analysisId);
    }

    // 11. Success response
    console.log(`✅ LinkedIn Analysis completed successfully for ${username}`);
    console.log(`📊 Generated: ${analysisResult.businessCompetencies.length} business competencies, expertiseNiche: ${analysisResult.expertiseNiche.name}`);
    console.log(`🎯 Niche: ${analysisResult.expertiseNiche.name} - ${analysisResult.expertiseNiche.marketValue}`);
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
    console.error('❌ LinkedIn endpoint error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET method - informacje o LinkedIn AI endpoint
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');

  if (!username) {
    return NextResponse.json({
      message: 'LinkedIn Creator Analysis AI Endpoint v2.0 with Database Integration',
      description: 'Enhanced with expertiseNiche discovery and automatic database storage',
      usage: 'POST with {"username": "linkedin_username"}',
      example: 'GET ?username=test_user for quick test',
      features: [
        'expertiseNiche instead of uniqueTalent',
        'businessCompetencies for professional context',
        'marketValue field',
        'evidence for expertise',
        'improved business-focused analysis',
        '🆕 Automatic database storage',
        '🆕 Smart caching (7 days)',
        '🆕 User session integration'
      ],
      database: {
        table: 'linkedin_creator_ai_analysis',
        strategy: 'upsert per userId+username',
        caching: '7 days auto-refresh',
        fields: ['profileDescription', 'businessCompetencies', 'expertiseNiche', 'metadata']
      }
    });
  }

  // Quick test - just show available data
  try {
    const posts = await prisma.linkedInCreatorAnalysis.findMany({
      where: { username },
      select: {
        postText: true,
        postUrn: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    // Sprawdź czy istnieją zapisane analizy AI
    const aiAnalysisCount = await prisma.linkedInCreatorAIAnalysis.count({
      where: { username }
    });

    return NextResponse.json({
      username,
      availablePosts: posts.length,
      samplePosts: posts.map(p => ({
        postUrn: p.postUrn,
        postTextPreview: p.postText.substring(0, 100) + '...',
        createdAt: p.createdAt
      })),
      aiAnalysisCount: aiAnalysisCount,
      message: 'Use POST method to generate LinkedIn AI analysis with expertiseNiche discovery and auto-save',
      version: 'v2.0-linkedin-database',
      databaseIntegration: {
        enabled: true,
        caching: '7 days',
        autoSave: true
      }
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Database error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}