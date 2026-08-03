import { sendMail } from '@/lib/mailer';
import { getBaseUrl } from '@/lib/passwordSetupEmail';

type TeamInviteEmailInput = {
  email: string;
  inviterName: string;
  projectName: string;
};

export async function sendTeamInviteEmail({ email, inviterName, projectName }: TeamInviteEmailInput) {
  const registerUrl = `${getBaseUrl()}/register`;

  await sendMail({
    to: email,
    subject: `You've been added to an isUD project`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
        <h1 style="font-size: 20px;">You've been added to an isUD project</h1>
        <p>${inviterName} has added you to the isUD project "${projectName}".</p>
        <p>Browse to your account or create one to accept the invitation.</p>
        <p>
          <a href="${registerUrl}" style="display: inline-block; background: #002a54; color: #ffffff; padding: 12px 18px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            Sign in or create an account
          </a>
        </p>
        <p style="font-size: 12px; color: #64748b;">If the button does not work, open this link: ${registerUrl}</p>
      </div>
    `,
    text: `${inviterName} has added you to the isUD project "${projectName}". Browse to your account or create one to accept the invitation: ${registerUrl}`,
  });

  return { delivered: true };
}
