export const ADMIN_EMAILS = [
  "enochaseks@yahoo.co.uk",
  "enochaseks@gmail.com",
];

export function isAdminEmail(email: string | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
