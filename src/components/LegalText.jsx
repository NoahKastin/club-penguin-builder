import React from 'react';

export function TermsOfService() {
  return (
    <div>
      <strong>Terms of Service</strong>
      <div style={{ color: '#ccc' }}>
        By creating an account or using Club Penguin Builder ("the Platform"), you agree to these terms. You are responsible for keeping your account credentials secure. You must be at least 13 years old to use the Platform.<br /><br />
        When you upload images to the Catalog, you represent that you own the content or have the rights to share it. Uploads are reviewed by automated AI moderation. The Platform may remove content that violates these terms. By uploading, you grant the Platform a license to display and distribute your content within the Platform.<br /><br />
        Pearls are a virtual currency that can be purchased via Stripe, earned by selling catalog items and games, and spent on catalog items and games. Pearls have no cash value unless withdrawn through Stripe Connect. Pearl purchases are non-refundable. The Platform may adjust Pearl pricing or availability at any time.<br /><br />
        You may not upload or facilitate content that is illegal, infringes on intellectual property, violates <a href="https://stripe.com/legal/restricted-businesses" target="_blank" rel="noopener noreferrer" style={{ color: '#4a90d9' }}>Stripe's Restricted Businesses policy</a>, or constitutes harassment or hate speech. Violations may result in account suspension without refund.<br /><br />
        The Platform is provided "as is" without warranties of any kind. To the fullest extent permitted by law, the Platform and its operators are not liable for any indirect, incidental, or consequential damages. The Platform is not available in Canada or the United Kingdom due to trademark considerations. These terms may be updated at any time; continued use constitutes acceptance. Source code is available under <a href="https://github.com/NoahKastin/club-penguin-builder" target="_blank" rel="noopener noreferrer" style={{ color: '#4a90d9' }}>CC-BY 4.0</a>.
      </div>
    </div>
  );
}

export function PrivacyPolicy() {
  return (
    <div>
      <strong>Privacy Policy</strong>
      <div style={{ color: '#ccc' }}>
        We collect your username, a bcrypt-hashed password (never stored in plaintext), content you upload, and Pearl transaction history. We do not collect your email address or any other personal contact information. We do not use cookies, tracking pixels, or analytics. Authentication state is stored in your browser's localStorage as a session token.<br /><br />
        Your data is used solely to operate the Platform: authentication, content display, and payment processing. Third-party services: <strong>Stripe</strong> processes payments and payouts (their privacy policy applies); <strong>OpenAI</strong> and <strong>Anthropic</strong> review uploads for content moderation.<br /><br />
        Your data is retained as long as your account exists. To request deletion, contact the Platform operator. Passwords are hashed with bcrypt and never stored in plaintext. The Platform is not directed at children under 13.
      </div>
    </div>
  );
}
