const SUPABASE_URL = "https://ywtlqgerqvgoiryzvlaa.supabase.co";
const SUPABASE_KEY = "sb_publishable_JkMNRWVf-xOGVHvm2qkqkA_qYtwjBC-";

const sb = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);
console.log("Supabase library:", window.supabase);
console.log("Supabase client:", sb);