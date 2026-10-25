/**
 * The password-reset email (Arabic and English). It contains only the reset
 * link and its expiry: never prompt text, a password, the user's name, or any
 * placeholder value.
 */
export function buildResetEmail(link: string, minutes: number): { subject: string; text: string; html: string } {
  const subject = 'إعادة تعيين كلمة المرور | Reset your password — Hares AI';
  const text = [
    'طلبت إعادة تعيين كلمة المرور لحسابك في حارس.',
    `افتح الرابط التالي خلال ${minutes} دقيقة. الرابط يُستخدم مرة واحدة فقط:`,
    link,
    'إذا لم تطلب ذلك، تجاهل هذه الرسالة.',
    '',
    'You asked to reset your Hares AI password.',
    `Open this link within ${minutes} minutes. It works only once:`,
    link,
    'If you did not ask for this, ignore this email.',
  ].join('\n');
  const href = escapeHtml(link);
  const html = `<!doctype html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6">
  <div dir="rtl" lang="ar">
    <p>طلبت إعادة تعيين كلمة المرور لحسابك في حارس.</p>
    <p>افتح الرابط التالي خلال ${minutes} دقيقة. الرابط يُستخدم مرة واحدة فقط:</p>
    <p><a href="${href}">إعادة تعيين كلمة المرور</a></p>
    <p>إذا لم تطلب ذلك، تجاهل هذه الرسالة.</p>
  </div>
  <hr>
  <div dir="ltr" lang="en">
    <p>You asked to reset your Hares AI password.</p>
    <p>Open this link within ${minutes} minutes. It works only once:</p>
    <p><a href="${href}">Reset password</a></p>
    <p>If you did not ask for this, ignore this email.</p>
  </div>
</body>
</html>`;
  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
