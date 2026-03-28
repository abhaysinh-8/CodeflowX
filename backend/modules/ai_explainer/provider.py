import asyncio
import os
from typing import AsyncGenerator


AI_PROVIDER = os.getenv("AI_PROVIDER", "openai")


# ---------------- GEMINI ---------------- #
async def gemini_stream(prompt: str) -> AsyncGenerator[str, None]:
    import google.generativeai as genai

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        yield "GEMINI_API_KEY is not configured."
        return

    genai.configure(api_key=api_key)

    model_name = os.getenv("GEMINI_MODEL", "gemini-flash-latest")
    model = genai.GenerativeModel(model_name)

    # Gemini SDK call is sync; run in thread so we do not block the event loop.
    response = await asyncio.to_thread(model.generate_content, prompt)

    # Gemini doesn't stream -> simulate streaming
    text = response.text if hasattr(response, "text") else str(response)

    for word in text.split():
        yield word + " "


# ---------------- OPENAI (KEEP EXISTING) ---------------- #
async def openai_stream(prompt: str) -> AsyncGenerator[str, None]:
    from openai import AsyncOpenAI

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        yield "OPENAI_API_KEY is not configured."
        return

    client = AsyncOpenAI(api_key=api_key)

    async with client.responses.stream(
        model="gpt-4o-mini",
        input=[
            {"role": "system", "content": "You are a precise code explanation assistant."},
            {"role": "user", "content": prompt},
        ],
    ) as stream:
        async for event in stream:
            if event.type == "response.output_text.delta":
                yield event.delta


# ---------------- SWITCH LOGIC ---------------- #
async def stream_completion(prompt: str) -> AsyncGenerator[str, None]:
    if AI_PROVIDER == "gemini":
        async for chunk in gemini_stream(prompt):
            yield chunk
    else:
        async for chunk in openai_stream(prompt):
            yield chunk
