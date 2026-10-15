import fs from 'fs';
import path from 'path';

async function testFind() {
  const serverUrl = process.env.API_URL || 'http://localhost:8787';
  console.log(`Testing find endpoint at ${serverUrl}/api/find ...`);

  // Create a minimal 1x1 test JPEG if no image provided
  const dummyBase64 =
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

  const res = await fetch(`${serverUrl}/api/find`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: dummyBase64,
      target: 'restroom',
      lang: 'en',
    }),
  });

  const data = await res.json();
  console.log('Result status:', res.status);
  console.log('Response body:', JSON.stringify(data, null, 2));
}

testFind().catch(console.error);
