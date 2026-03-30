// Lazy-load AI SDKs to avoid slowing down server startup
let openai = null;
let anthropic = null;
let initialized = false;

function init() {
  if (initialized) return;
  initialized = true;

  if (process.env.OPENAI_API_KEY) {
    import('openai').then(({ default: OpenAI }) => {
      openai = new OpenAI();
      console.log('OpenAI moderation ready');
    }).catch(err => console.warn('Failed to load OpenAI SDK:', err.message));
  } else {
    console.warn('OPENAI_API_KEY not set — content safety check disabled');
  }

  if (process.env.ANTHROPIC_API_KEY) {
    import('@anthropic-ai/sdk').then(({ default: Anthropic }) => {
      anthropic = new Anthropic();
      console.log('Anthropic copyright check ready');
    }).catch(err => console.warn('Failed to load Anthropic SDK:', err.message));
  } else {
    console.warn('ANTHROPIC_API_KEY not set — copyright check disabled');
  }
}

// Initialize lazily on first call
setTimeout(init, 0);

const CATEGORY_LABELS = {
  sexual: 'sexual content',
  'sexual/minors': 'sexual content involving minors',
  harassment: 'harassment',
  'harassment/threatening': 'threatening harassment',
  hate: 'hate speech',
  'hate/threatening': 'threatening hate speech',
  illicit: 'illicit content',
  'illicit/violent': 'illicit violent content',
  'self-harm': 'self-harm',
  'self-harm/intent': 'self-harm intent',
  'self-harm/instructions': 'self-harm instructions',
  violence: 'violence',
  'violence/graphic': 'graphic violence',
};

export async function checkContentSafety(imageDataUrl) {
  if (!openai) return { ok: true };

  try {
    const moderation = await openai.moderations.create({
      model: 'omni-moderation-latest',
      input: [
        { type: 'image_url', image_url: { url: imageDataUrl } },
      ],
    });

    const result = moderation.results[0];
    if (result.flagged) {
      const flagged = Object.entries(result.categories)
        .filter(([, v]) => v)
        .map(([k]) => CATEGORY_LABELS[k] || k);
      return { ok: false, reason: `Image rejected: contains ${flagged.join(', ')}` };
    }

    return { ok: true };
  } catch (err) {
    console.warn('OpenAI moderation error (fail-open):', err.message);
    return { ok: true };
  }
}

export async function checkCopyright(imageDataUrl, itemName) {
  if (!anthropic) return { ok: true };

  try {
    const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) return { ok: true };

    const mediaType = match[1];
    const base64Data = match[2];

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64Data },
          },
          {
            type: 'text',
            text: `You are a copyright detection system for a user-generated game platform where players create original art for Club Penguin-style games. The "Club Penguin" and "Puffle" trademarks are inactive in the US — users ARE allowed to create and name original art using these terms.

Your job is ONLY to detect directly copied or ripped art assets — specifically, actual sprites or images extracted from the original Disney Club Penguin game files (the kind archived from the original game's SWF assets), even if scaled up or down. The original Club Penguin used a distinctive 3D-rendered Flash animation art style.

Do NOT flag:
- Original art, even if it depicts concepts from Club Penguin like puffles, penguins, or igloos
- Art that is stylistically similar but clearly a new creation, not an exact copy
- Art named with Club Penguin terms — the trademarks are inactive

Analyze this image (named "${itemName}"). Is this a directly copied/ripped asset from the original Club Penguin game or another existing copyrighted game? Respond with ONLY valid JSON: {"flagged": true/false, "reason": "..."}`,
          },
        ],
      }],
    });

    const text = response.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { ok: true };

    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.flagged) {
      return { ok: false, reason: `Image rejected: ${parsed.reason || 'possible copyright concern'}` };
    }

    return { ok: true };
  } catch (err) {
    console.warn('Copyright check error (fail-open):', err.message);
    return { ok: true };
  }
}

export async function moderateUpload(imageDataUrl, itemName) {
  const safety = await checkContentSafety(imageDataUrl);
  if (!safety.ok) return safety;

  const copyright = await checkCopyright(imageDataUrl, itemName);
  if (!copyright.ok) return copyright;

  return { ok: true };
}
