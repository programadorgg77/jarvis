"""Receive one sentence on stdin; return only MP3 bytes on stdout."""
import asyncio
import json
import sys
import edge_tts

async def main():
    request = json.loads(sys.stdin.buffer.read(32768).decode('utf-8'))
    text = request.get('text', '')
    if not isinstance(text, str) or not text.strip() or len(text) > 8000:
        raise ValueError('Invalid sentence')
    voice = edge_tts.Communicate(text, voice='pt-BR-AntonioNeural', rate='+0%', pitch='-2Hz', connect_timeout=5, receive_timeout=8)
    async for chunk in voice.stream():
        if chunk['type'] == 'audio':
            sys.stdout.buffer.write(chunk['data'])
            sys.stdout.buffer.flush()

if __name__ == '__main__':
    asyncio.run(main())
