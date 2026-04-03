# Viewer Icons

Put custom SVG files in this directory.

Naming rules:

- Each file must be named `<slug>.svg`.
- The matcher is case-insensitive on the session/provider side, but the file
  lookup uses the exact slug from `src/viewer/assets.ts`.
- For the main conversation, use `openclaw.svg`.
- For TUI, use `ghostty.svg`.
- For Weixin/Wechat, both map to `wechat.svg`.

Channel icon filenames currently used:

- `discord.svg`
- `telegram.svg`
- `ghostty.svg`
- `wechat.svg`
- `whatsapp.svg`
- `slack.svg`
- `signal.svg`
- `googlechat.svg`
- `imessage.svg`
- `irc.svg`
- `line.svg`
- `openclaw.svg`

Provider icon filenames currently used:

- `vercel.svg`
- `openrouter.svg`
- `azure-color.svg`
- `openai.svg`
- `anthropic.svg`
- `google-color.svg`
- `deepseek-color.svg`
- `mistral-color.svg`
- `meta-color.svg`
- `cohere-color.svg`
- `perplexity-color.svg`
- `groq.svg`
- `together-color.svg`
- `fireworks-color.svg`
- `aws-color.svg`
- `zhipu-color.svg`
- `moonshot.svg`
- `qwen-color.svg`
- `alibaba-color.svg`
- `baichuan-color.svg`
- `minimax-color.svg`
- `zeroone.svg`
- `ai21-brand-color.svg`
- `bytedance-color.svg`
- `spark-color.svg`
- `ollama.svg`
- `huggingface-color.svg`
- `replicate-brand.svg`
- `xai.svg`
- `siliconcloud-color.svg`
- `stepfun-color.svg`
- `nvidia-color.svg`
- `cloudflare-color.svg`
- `sambanova-color.svg`
- `cerebras-brand-color.svg`

If a matching file is missing, the viewer falls back to the generated local SVG
placeholder from `src/viewer/assets.ts`.
