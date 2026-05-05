import Nylas from "nylas";

// Initialize Nylas client
const nylas = new Nylas({
  apiKey: process.env.NYLAS_API_KEY!,
  apiUri: process.env.NYLAS_API_URI || "https://api.us.nylas.com",
});

export default nylas;

export const NYLAS_CLIENT_ID = process.env.NYLAS_CLIENT_ID!;
