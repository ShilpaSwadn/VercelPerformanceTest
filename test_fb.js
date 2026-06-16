import { adminAuth } from './lib/server/config/firebase-admin.js';

async function test() {
  try {
    const user = await adminAuth.getUserByEmail('user1@gmail.com');
    console.log("User exists:", user.uid);
  } catch (e) {
    console.log("Error:", e.message);
  }
}
test();
