// src/services/emailService.js
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  // ─── Send Welcome Email ──────────────────────────────────────────────────
    // ─── Send Welcome Email ──────────────────────────────────────────────────
  async sendWelcomeEmail(user, tenants = []) {
    const html = this.getWelcomeEmailHTML(user, tenants);
    
    const mailOptions = {
      from: `"MeterBondhu" <${process.env.EMAIL_FROM}>`,
      to: user.email,
      subject: user.user_type === 'owner'
        ? '🎉 Welcome to MeterBondhu — Your Account is Ready!'
        : '🎉 Welcome to MeterBondhu - DESCO Smart Meter Monitor',
      html: html,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Welcome email sent to:', user.email);
      console.log('📧 Email ID:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Email send error:', error.message);
      return false;
    }
  }

  // ─── Send Alert Email ────────────────────────────────────────────────────
  async sendAlertEmail(user, alertData) {
    const html = this.getAlertEmailHTML(user, alertData);
    
    const mailOptions = {
      from: `"MeterBondhu" <${process.env.EMAIL_FROM}>`,
      to: user.email,
      subject: `⚡ Low Balance Alert - ৳${alertData.balance}`,
      html: html,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Alert email sent to:', user.email);
      return true;
    } catch (error) {
      console.error('❌ Alert email error:', error.message);
      return false;
    }
  }

  // ─── Send Daily Report Email ────────────────────────────────────────────
  async sendDailyReportEmail(user, reportData) {
    const html = this.getDailyReportHTML(user, reportData);
    
    const mailOptions = {
      from: `"MeterBondhu" <${process.env.EMAIL_FROM}>`,
      to: user.email,
      subject: `📊 Your Daily DESCO Meter Report - ${new Date().toLocaleDateString()}`,
      html: html,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Daily report sent to:', user.email);
      return true;
    } catch (error) {
      console.error('❌ Daily report error:', error.message);
      return false;
    }
  }

  // ─── Welcome Email HTML ──────────────────────────────────────────────────
  getWelcomeEmailHTML(user, tenants = []) {
    const isOwner = user.user_type === 'owner';
    const userTypeLabel = isOwner ? 'Landlord' : 'Tenant';
    const frontendUrl = process.env.FRONTEND_URL || 'https://meterbondhu.com';

    // ─── Palette (light theme, table-based) ─────────────────────────────
    const ink = '#0f172a';
    const muted = '#64748b';
    const brandBlue = '#2563eb';
    const success = '#16a34a';

    // ─── Helper: two-column row ─────────────────────────────────────────
    const infoRow = (label, value, opts = {}) => {
      const { bold = false, color = ink, icon = '' } = opts;
      return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
          <tr>
            <td width="50%" align="left" style="padding:8px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:13px; color:${muted};">${icon ? `${icon} ` : ''}${label}</td>
            <td width="50%" align="right" style="padding:8px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:13.5px; color:${color}; font-weight:${bold ? '800' : '700'}; word-break:break-word;">${value}</td>
          </tr>
        </table>`;
    };

    const boxWrap = (inner, { bg = '#f8fafc', border = '#e2e8f0' } = {}) => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${bg}" style="background-color:${bg}; border:1px solid ${border}; border-radius:10px; margin:14px 0;">
        <tr><td style="padding:16px 20px;">${inner}</td></tr>
      </table>`;

    const sectionTitle = (icon, text) => `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:11px; font-weight:800; letter-spacing:1.5px; color:${muted}; text-transform:uppercase; padding:4px 0 8px;">
        ${icon} ${text}
      </div>`;

    // ─── Feature list (uniform, crisp rows) ─────────────────────────────
    const features = [
      { icon: '&#128276;', title: 'Low Balance Alerts', desc: 'Get notified before your electricity runs out.' },
      { icon: '&#129302;', title: 'AI-Powered Suggestions', desc: 'Smart insights to reduce your electricity cost.' },
      { icon: '&#128202;', title: 'Smart Usage Analytics', desc: 'Track daily, weekly, and monthly consumption trends.' },
      { icon: '&#9889;', title: 'Real-Time Meter Monitoring', desc: 'Check balance, consumption, and recharge history.' },
      { icon: '&#128200;', title: 'Consumption Trends & Reports', desc: 'Understand patterns through easy-to-read visuals.' },
      { icon: '&#128101;', title: 'Multiple Meter Management', desc: 'Manage homes, apartments, or properties in one place.' },
    ];

    const featuresHTML = features.map((f) => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid #e2e8f0;">
        <tr>
          <td width="32" valign="top" style="padding:12px 10px 12px 0; font-size:18px; line-height:1.3;">${f.icon}</td>
          <td valign="top" style="padding:12px 0;">
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:13.5px; font-weight:700; color:${ink};">${f.title}</div>
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:${muted}; margin-top:2px; line-height:1.5;">${f.desc}</div>
          </td>
        </tr>
      </table>`).join('');

    // ─── Tenants section (only for owners with tenants) ─────────────────
    let tenantsHTML = '';
    if (isOwner && Array.isArray(tenants) && tenants.length > 0) {
      const tenantRows = tenants.map((t, i) => `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${i < tenants.length - 1 ? 'border-bottom:1px dashed #e2e8f0;' : ''}">
          <tr>
            <td width="42" valign="middle" style="padding:12px 12px 12px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="34" height="34" style="width:34px; height:34px; background-color:#dbeafe; border-radius:17px;">
                <tr>
                  <td align="center" valign="middle" style="font-size:14px; color:${brandBlue}; font-weight:800; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${i + 1}</td>
                </tr>
              </table>
            </td>
            <td valign="middle" style="padding:12px 0;">
              <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:13.5px; font-weight:800; color:${ink}; letter-spacing:-0.2px;">
                ${t.flat || '—'}${t.name ? `<span style="font-weight:600; color:${muted}; font-size:12px;"> &middot; ${t.name}</span>` : ''}
              </div>
              <div style="font-family:'Courier New',Consolas,monospace; font-size:11.5px; color:${muted}; margin-top:3px;">
                Acc ${t.account_no || 'N/A'} &bull; Meter ${t.meter_no || 'N/A'}
              </div>
            </td>
          </tr>
        </table>`).join('');

      const tenantBoxInner = `
        ${sectionTitle('&#128101;', `Your Tenant Meters (${tenants.length})`)}
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:${muted}; line-height:1.6; margin-bottom:6px;">
          These tenant meters have been linked to your account. You can monitor their usage from your dashboard.
        </div>
        <div style="margin-top:6px; background-color:#ffffff; border-radius:8px; padding:4px 16px; border:1px solid #e2e8f0;">
          ${tenantRows}
        </div>`;

      tenantsHTML = boxWrap(tenantBoxInner, { bg: '#eff6ff', border: '#bfdbfe' });
    } else if (isOwner) {
      // Owner but no tenants — info box
      const tenantBoxInner = `
        ${sectionTitle('&#128101;', 'Tenant Meters')}
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:13px; color:${muted}; line-height:1.7;">
          You haven't added any tenant meters yet. You can add them anytime from your dashboard.
        </div>`;
      tenantsHTML = boxWrap(tenantBoxInner, { bg: '#f8fafc', border: '#e2e8f0' });
    }

    // ─── Meter info box (owner: own meter; tenant: their meter) ──────────
    const meterBoxInner = `
      ${sectionTitle('&#128203;', 'Your Account Details')}
      ${infoRow('Account Number', user.account_no || 'Not set', { bold: true })}
      ${infoRow('Meter Number', user.meter_no || 'Not set', { bold: true })}
      ${infoRow('User Type', userTypeLabel)}
      ${infoRow('Member ID', user.m_bondhu_id || 'N/A')}`;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Welcome to MeterBondhu</title>
<style>
  body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; border-collapse:collapse; }
  img { -ms-interpolation-mode:bicubic; border:0; }
  body { margin:0; padding:0; width:100% !important; background-color:#f1f5f9; }
  :root { color-scheme: light; supported-color-schemes: light; }
  [data-ogsc] .force-ink { color:#0f172a !important; }
  [data-ogsc] .force-card { background-color:#ffffff !important; }
  @media only screen and (max-width:520px) {
    .email-wrap { width:100% !important; }
    .content-pad { padding-left:20px !important; padding-right:20px !important; }
    .hero-name { font-size:22px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f1f5f9">
    <tr>
      <td align="center" style="padding:28px 12px;">

        <table role="presentation" class="email-wrap" width="580" cellpadding="0" cellspacing="0" border="0" style="width:580px; max-width:580px;">
          <tr>
            <td bgcolor="#ffffff" class="force-card" style="background-color:#ffffff; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">

              <!-- ═══ TOP ACCENT BAR ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td height="5" bgcolor="${brandBlue}" style="background-color:${brandBlue}; font-size:0; line-height:5px;">&nbsp;</td></tr>
              </table>

              <!-- ═══ HEADER ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td class="content-pad" align="center" style="padding:32px 30px 24px;">
                  <div class="force-ink" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:30px; font-weight:900; color:${ink}; letter-spacing:-0.8px;">Meter<span style="color:${brandBlue};">Bondhu</span></div>
                  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:10.5px; font-weight:700; letter-spacing:3px; color:${muted}; text-transform:uppercase; margin-top:4px;">DESCO Smart Meter Monitor</div>

                  <!-- Success badge -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px auto 0;">
                    <tr>
                      <td align="center" bgcolor="#ecfdf5" style="background-color:#ecfdf5; border:1.5px solid ${success}; border-radius:22px; padding:8px 20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:11px; font-weight:900; letter-spacing:1.5px; color:${success}; white-space:nowrap;">
                        &#10003; WELCOME ABOARD
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>

              <!-- ═══ HERO GREETING ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td class="content-pad" style="padding:0 30px 4px;">
                  <div class="force-ink hero-name" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:24px; font-weight:800; color:${ink}; letter-spacing:-0.4px; line-height:1.3;">
                    Welcome, <span style="color:${brandBlue};">${user.full_name}</span>! &#128075;
                  </div>
                  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:14px; color:${muted}; margin-top:10px; line-height:1.7;">
                    ${isOwner
                      ? `Thank you for joining MeterBondhu! Your landlord account is now ready${tenants.length > 0 ? ` with ${tenants.length} tenant meter${tenants.length > 1 ? 's' : ''}` : ''}. Monitor every meter from a single dashboard.`
                      : 'Thank you for joining MeterBondhu! Your account is now ready. Start tracking your DESCO prepaid meter today.'}
                  </div>
                </td></tr>
              </table>

              <!-- ═══ ACCOUNT DETAILS BOX ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td class="content-pad" style="padding:8px 30px 0;">
                  ${boxWrap(meterBoxInner, { bg: '#f8fafc', border: '#e2e8f0' })}
                </td></tr>
              </table>

              <!-- ═══ TENANTS SECTION (owner only) ═══ -->
              ${tenantsHTML ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td class="content-pad" style="padding:0 30px;">
                  ${tenantsHTML}
                </td></tr>
              </table>` : ''}

              <!-- ═══ DIVIDER ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td class="content-pad" style="padding:0 30px;">
                  <div style="height:1px; background-color:#e2e8f0; font-size:0; line-height:1px;">&nbsp;</div>
                </td></tr>
              </table>

              <!-- ═══ FEATURES ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td class="content-pad" style="padding:24px 30px 8px;">
                  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:16px; font-weight:800; color:${ink}; letter-spacing:-0.3px; margin-bottom:6px;">
                    What You Can Do With MeterBondhu
                  </div>
                  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:${muted}; margin-bottom:8px;">
                    Everything you need to manage your prepaid meter in one place.
                  </div>
                  ${featuresHTML}
                </td></tr>
              </table>

              <!-- ═══ SUPPORT NOTE ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td class="content-pad" style="padding:8px 30px 26px;">
                  <div style="background-color:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:14px 16px;">
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; font-weight:700; color:#b45309; margin-bottom:4px;">
                      &#128161; Quick Tip
                    </div>
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:#78350f; line-height:1.6;">
                      Set your low balance threshold from Settings and never get caught off guard again.
                    </div>
                  </div>
                </td></tr>
              </table>

              <!-- ═══ FOOTER ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td class="content-pad" align="center" style="padding:0 30px 26px;">
                  <div style="border-top:1px solid #e2e8f0; padding-top:18px; width:100%;">
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12px; color:${muted}; line-height:1.6;">
                      &copy; 2026 MeterBondhu &bull; Powered by <a href="https://www.nexoraq.tech/" style="color:${brandBlue}; text-decoration:none;">Nexoraq Tech</a>
                    </div>
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:11px; color:#94a3b8; margin-top:6px;">
                      Sent to ${user.email}
                    </div>
                  </div>
                </td></tr>
              </table>

            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>
    `;
  }

    // ─── Send OTP Email ────────────────────────────────────────────────────────
   // ─── Send OTP Email (Password Reset) ───────────────────────────────────────
  async sendOTPEmail(user, otp) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Password Reset OTP</title>
<style>
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
  img { -ms-interpolation-mode: bicubic; border: 0; }
  body { margin: 0; padding: 0; width: 100% !important; background-color: #f1f5f9; }
  :root { color-scheme: light; supported-color-schemes: light; }
  [data-ogsc] .force-ink { color: #0f172a !important; }
  [data-ogsc] .force-card { background-color: #ffffff !important; }
  @media only screen and (max-width: 520px) {
    .email-wrap { width: 100% !important; }
    .content-pad { padding-left: 18px !important; padding-right: 18px !important; }
    .otp-code { font-size: 30px !important; letter-spacing: 6px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f1f5f9">
    <tr>
      <td align="center" style="padding:28px 12px;">

        <table role="presentation" class="email-wrap" width="540" cellpadding="0" cellspacing="0" border="0" style="width:540px; max-width:540px;">
          <tr>
            <td bgcolor="#ffffff" class="force-card" style="background-color:#ffffff; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">

              <!-- ═══ TOP ACCENT BAR ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td height="5" bgcolor="#2563eb" style="background-color:#2563eb; border-radius:12px 12px 0 0; font-size:0; line-height:5px;">&nbsp;</td></tr>
              </table>

              <!-- ═══ HEADER ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td class="content-pad" align="center" style="padding:32px 30px 20px;">
                  <div class="force-ink" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:30px; font-weight:900; color:#0f172a; letter-spacing:-0.8px;">Meter<span style="color:#2563eb;">Bondhu</span></div>
                  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:10.5px; font-weight:700; letter-spacing:3px; color:#64748b; text-transform:uppercase; margin-top:4px;">Password Reset Verification</div>

                  <!-- Badge pill -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px auto 0;">
                    <tr>
                      <td align="center" bgcolor="#eff6ff" style="background-color:#eff6ff; border:1.5px solid #bfdbfe; border-radius:22px; padding:8px 20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:11px; font-weight:900; letter-spacing:1.5px; color:#2563eb; white-space:nowrap;">
                        &#128272; VERIFICATION CODE
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>

              <!-- ═══ GREETING ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td class="content-pad" style="padding:0 30px 4px;">
                  <div class="force-ink" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:20px; font-weight:800; color:#0f172a; letter-spacing:-0.3px; line-height:1.3;">
                    Hello, <span style="color:#2563eb;">${user.full_name}</span>! &#128075;
                  </div>
                  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:13.5px; color:#64748b; margin-top:10px; line-height:1.7;">
                    You requested to reset your password. Use the OTP below to verify your identity.
                  </div>
                </td></tr>
              </table>

              <!-- ═══ OTP BOX ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td class="content-pad" style="padding:16px 30px 0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#eff6ff" style="background-color:#eff6ff; border:2px dashed #bfdbfe; border-radius:10px;">
                    <tr>
                      <td align="center" style="padding:24px 20px;">
                        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:10.5px; font-weight:800; letter-spacing:2.5px; color:#2563eb; text-transform:uppercase;">Your OTP Code</div>
                        <div class="otp-code" style="font-family:'Courier New',Consolas,monospace; font-size:38px; font-weight:900; color:#2563eb; letter-spacing:10px; margin-top:10px; word-break:break-all;">${otp}</div>
                        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:11.5px; color:#64748b; margin-top:12px;">&#8987; This OTP is valid for 1 minutes</div>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>

              <!-- ═══ WARNING BOX ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td class="content-pad" style="padding:14px 30px 0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fffbeb" style="background-color:#fffbeb; border:1px solid #fde68a; border-radius:8px;">
                    <tr><td style="padding:14px 16px;">
                      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12px; font-weight:700; color:#b45309; margin-bottom:4px;">
                        &#9888; Security Notice
                      </div>
                      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:#78350f; line-height:1.6;">
                        If you didn't request this password reset, please ignore this email. Never share this OTP with anyone &mdash; MeterBondhu will never ask for it.
                      </div>
                    </td></tr>
                  </table>
                </td></tr>
              </table>

              <!-- ═══ FOOTER ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td class="content-pad" align="center" style="padding:22px 30px 26px;">
                  <div style="border-top:1px solid #e2e8f0; padding-top:18px; width:100%;">
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12px; color:#64748b; line-height:1.6;">
                      &copy; 2026 MeterBondhu &bull; Powered by <a href="https://www.nexoraq.tech/" style="color:#2563eb; text-decoration:none;">Nexoraq Tech</a>
                    </div>
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:11px; color:#94a3b8; margin-top:6px;">
                      This email was sent to ${user.email}
                    </div>
                  </div>
                </td></tr>
              </table>

            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>
    `;

    const mailOptions = {
      from: `"MeterBondhu" <${process.env.EMAIL_FROM}>`,
      to: user.email,
      subject: '🔐 Password Reset OTP - MeterBondhu',
      html: html,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ OTP email sent to:', user.email);
      return true;
    } catch (error) {
      console.error('❌ OTP email error:', error.message);
      return false;
    }
  }

  // ─── Send Password Change OTP Email ───────────────────────────────────────
  async sendPasswordChangeOTPEmail(user, otp) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Password Change Verification</title>
<style>
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
  img { -ms-interpolation-mode: bicubic; border: 0; }
  body { margin: 0; padding: 0; width: 100% !important; background-color: #f1f5f9; }
  :root { color-scheme: light; supported-color-schemes: light; }
  [data-ogsc] .force-ink { color: #0f172a !important; }
  [data-ogsc] .force-card { background-color: #ffffff !important; }
  @media only screen and (max-width: 520px) {
    .email-wrap { width: 100% !important; }
    .content-pad { padding-left: 18px !important; padding-right: 18px !important; }
    .otp-code { font-size: 30px !important; letter-spacing: 6px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f1f5f9">
    <tr>
      <td align="center" style="padding:28px 12px;">

        <table role="presentation" class="email-wrap" width="540" cellpadding="0" cellspacing="0" border="0" style="width:540px; max-width:540px;">
          <tr>
            <td bgcolor="#ffffff" class="force-card" style="background-color:#ffffff; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">

              <!-- ═══ TOP ACCENT BAR (AMBER) ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td height="5" bgcolor="#f59e0b" style="background-color:#f59e0b; border-radius:12px 12px 0 0; font-size:0; line-height:5px;">&nbsp;</td></tr>
              </table>

              <!-- ═══ HEADER ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td class="content-pad" align="center" style="padding:32px 30px 20px;">
                  <div class="force-ink" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:30px; font-weight:900; color:#0f172a; letter-spacing:-0.8px;">Meter<span style="color:#f59e0b;">Bondhu</span></div>
                  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:10.5px; font-weight:700; letter-spacing:3px; color:#64748b; text-transform:uppercase; margin-top:4px;">Password Change Verification</div>

                  <!-- Badge pill -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px auto 0;">
                    <tr>
                      <td align="center" bgcolor="#fffbeb" style="background-color:#fffbeb; border:1.5px solid #fde68a; border-radius:22px; padding:8px 20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:11px; font-weight:900; letter-spacing:1.5px; color:#b45309; white-space:nowrap;">
                        &#128272; CHANGE PASSWORD
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>

              <!-- ═══ GREETING ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td class="content-pad" style="padding:0 30px 4px;">
                  <div class="force-ink" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:20px; font-weight:800; color:#0f172a; letter-spacing:-0.3px; line-height:1.3;">
                    Hello, <span style="color:#f59e0b;">${user.full_name}</span>! &#128075;
                  </div>
                  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:13.5px; color:#64748b; margin-top:10px; line-height:1.7;">
                    You requested to change your account password. Use the verification code below to confirm this action.
                  </div>
                </td></tr>
              </table>

              <!-- ═══ OTP BOX ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td class="content-pad" style="padding:16px 30px 0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fffbeb" style="background-color:#fffbeb; border:2px dashed #fde68a; border-radius:10px;">
                    <tr>
                      <td align="center" style="padding:24px 20px;">
                        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:10.5px; font-weight:800; letter-spacing:2.5px; color:#b45309; text-transform:uppercase;">Verification Code</div>
                        <div class="otp-code" style="font-family:'Courier New',Consolas,monospace; font-size:38px; font-weight:900; color:#f59e0b; letter-spacing:10px; margin-top:10px; word-break:break-all;">${otp}</div>
                        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:11.5px; color:#64748b; margin-top:12px;">&#8987; This code is valid for 1 minutes</div>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>

              <!-- ═══ WARNING BOX ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td class="content-pad" style="padding:14px 30px 0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fef2f2" style="background-color:#fef2f2; border:1px solid #fecaca; border-radius:8px;">
                    <tr><td style="padding:14px 16px;">
                      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12px; font-weight:700; color:#b91c1c; margin-bottom:4px;">
                        &#9888; Security Notice
                      </div>
                      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:#7f1d1d; line-height:1.6;">
                        If you didn't request this password change, please secure your account immediately and DO NOT share this code with anyone.
                      </div>
                    </td></tr>
                  </table>
                </td></tr>
              </table>

              <!-- ═══ FOOTER ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td class="content-pad" align="center" style="padding:22px 30px 26px;">
                  <div style="border-top:1px solid #e2e8f0; padding-top:18px; width:100%;">
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12px; color:#64748b; line-height:1.6;">
                      &copy; 2026 MeterBondhu &bull; Powered by <a href="https://www.nexoraq.tech/" style="color:#f59e0b; text-decoration:none;">Nexoraq Tech</a>
                    </div>
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:11px; color:#94a3b8; margin-top:6px;">
                      This email was sent to ${user.email}
                    </div>
                  </div>
                </td></tr>
              </table>

            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>
    `;

    const mailOptions = {
      from: `"MeterBondhu" <${process.env.EMAIL_FROM}>`,
      to: user.email,
      subject: '🔐 Password Change Verification - MeterBondhu',
      html: html,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Password change OTP email sent to:', user.email);
      return true;
    } catch (error) {
      console.error('❌ Password change OTP email error:', error.message);
      return false;
    }
  }



  // ─── Send Password Reset Confirmation ─────────────────────────────────────
  async sendPasswordResetConfirmation(user) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Password Reset Successful</title>
<style>
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
  img { -ms-interpolation-mode: bicubic; border: 0; }
  body { margin: 0; padding: 0; width: 100% !important; background-color: #f1f5f9; }
  :root { color-scheme: light; supported-color-schemes: light; }
  [data-ogsc] .force-ink { color: #0f172a !important; }
  [data-ogsc] .force-card { background-color: #ffffff !important; }
  @media only screen and (max-width: 520px) {
    .email-wrap { width: 100% !important; }
    .content-pad { padding-left: 18px !important; padding-right: 18px !important; }
    .success-icon { width: 72px !important; height: 72px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f1f5f9">
    <tr>
      <td align="center" style="padding:28px 12px;">

        <table role="presentation" class="email-wrap" width="540" cellpadding="0" cellspacing="0" border="0" style="width:540px; max-width:540px;">
          <tr>
            <td bgcolor="#ffffff" class="force-card" style="background-color:#ffffff; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">

              <!-- ═══ TOP ACCENT BAR (GREEN) ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td height="5" bgcolor="#16a34a" style="background-color:#16a34a; border-radius:12px 12px 0 0; font-size:0; line-height:5px;">&nbsp;</td></tr>
              </table>

              <!-- ═══ HEADER ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td class="content-pad" align="center" style="padding:32px 30px 20px;">
                  <div class="force-ink" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:30px; font-weight:900; color:#0f172a; letter-spacing:-0.8px;">Meter<span style="color:#16a34a;">Bondhu</span></div>
                  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:10.5px; font-weight:700; letter-spacing:3px; color:#64748b; text-transform:uppercase; margin-top:4px;">Password Reset</div>

                  <!-- Badge pill -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px auto 0;">
                    <tr>
                      <td align="center" bgcolor="#f0fdf4" style="background-color:#f0fdf4; border:1.5px solid #bbf7d0; border-radius:22px; padding:8px 20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:11px; font-weight:900; letter-spacing:1.5px; color:#16a34a; white-space:nowrap;">
                        &#10003; SUCCESS
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>

              <!-- ═══ SUCCESS ICON ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td class="content-pad" align="center" style="padding:8px 30px 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                    <tr>
                      <td align="center" valign="middle" bgcolor="#f0fdf4" class="success-icon" style="background-color:#f0fdf4; border:2px solid #bbf7d0; border-radius:50%; width:80px; height:80px; vertical-align:middle; text-align:center;">
                        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:38px; line-height:80px; color:#16a34a;">&#10003;</div>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>

              <!-- ═══ TITLE + MESSAGE ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td class="content-pad" align="center" style="padding:20px 30px 0;">
                  <div class="force-ink" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:20px; font-weight:800; color:#0f172a; letter-spacing:-0.3px; line-height:1.3; text-align:center;">
                    Password Reset Successful
                  </div>
                  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:13.5px; color:#64748b; margin-top:10px; line-height:1.7; text-align:center; padding:0 8px;">
                    Your password has been reset successfully. You can now login with your new password.
                  </div>
                </td></tr>
              </table>

              <!-- ═══ SUCCESS CARD ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td class="content-pad" style="padding:20px 30px 0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f0fdf4" style="background-color:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px;">
                    <tr><td style="padding:16px 20px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="32" valign="middle" style="font-size:18px; line-height:1.2; padding-right:12px;">&#128274;</td>
                          <td valign="middle" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:13px; color:#166534; line-height:1.6;">
                            <strong style="color:#15803d; font-weight:800;">What's next?</strong><br>
                            You can now log in to your MeterBondhu account using your new password.
                          </td>
                        </tr>
                      </table>
                    </td></tr>
                  </table>
                </td></tr>
              </table>

              <!-- ═══ SECURITY NOTICE ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td class="content-pad" style="padding:14px 30px 0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fffbeb" style="background-color:#fffbeb; border:1px solid #fde68a; border-radius:8px;">
                    <tr><td style="padding:14px 16px;">
                      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12px; font-weight:700; color:#b45309; margin-bottom:4px;">
                        &#9888; Security Notice
                      </div>
                      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:#78350f; line-height:1.6;">
                        If you did not make this change, please contact our support team immediately and secure your account.
                      </div>
                    </td></tr>
                  </table>
                </td></tr>
              </table>

              <!-- ═══ FOOTER ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td class="content-pad" align="center" style="padding:22px 30px 26px;">
                  <div style="border-top:1px solid #e2e8f0; padding-top:18px; width:100%;">
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12px; color:#64748b; line-height:1.6;">
                      &copy; 2026 MeterBondhu &bull; Powered by <a href="https://www.nexoraq.tech/" style="color:#16a34a; text-decoration:none;">Nexoraq Tech</a>
                    </div>
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:11px; color:#94a3b8; margin-top:6px;">
                      This email was sent to ${user.email}
                    </div>
                  </div>
                </td></tr>
              </table>

            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>
    `;

    const mailOptions = {
      from: `"MeterBondhu" <${process.env.EMAIL_FROM}>`,
      to: user.email,
      subject: '✅ Password Reset Successful - MeterBondhu',
      html: html,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Password reset confirmation sent to:', user.email);
      return true;
    } catch (error) {
      console.error('❌ Confirmation email error:', error.message);
      return false;
    }
  }

  // ─── Send Recharge Receipt Email ─────────────────────────────────────────
    async sendRechargeReceiptEmail(user, rechargeData) {
    const html = this.getRechargeReceiptHTML(user, rechargeData);
    
    const mailOptions = {
      from: `"MeterBondhu" <${process.env.EMAIL_FROM}>`,
      to: user.email,
      subject: `🧾 Recharge Confirmation - ৳${rechargeData.totalAmount}`,
      html: html,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Recharge receipt sent to:', user.email);
      return true;
    } catch (error) {
      console.error('❌ Recharge receipt error:', error.message);
      return false;
    }
  }
  
  // ─── Send Monthly Report Email ────────────────────────────────────────────
async sendMonthlyReportEmail(user, reportData) {
  const html = this.getMonthlyReportHTML(user, reportData);

  const mailOptions = {
    from: `"MeterBondhu" <${process.env.EMAIL_FROM}>`,
    to: user.email,
    subject: `📅 Your Monthly Report — ${reportData.monthLabel}`,
    html: html,
  };

  try {
    const info = await this.transporter.sendMail(mailOptions);
    console.log('✅ Monthly report sent to:', user.email);
    return true;
  } catch (error) {
    console.error('❌ Monthly report error:', error.message);
    return false;
  }
}
  // ─── Recharge Receipt Email HTML ──────────────────────────────────────────
  getRechargeReceiptHTML(user, rechargeData) {
  const {
    totalAmount,
    energyAmount,
    chargeAmount,
    rechargeDate,
    rechargeOperator,
    orderStatus,
    seqNo,
    orderID,
    tokenNo,
    VAT,
    rebate,
    chargeItems = [],
  } = rechargeData;

  const date = rechargeDate ? new Date(rechargeDate) : new Date();
  const formattedDate = date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const isSuccess = orderStatus === 'Execution Successful';

  // ─── Logo URL based on meter_type ──────────────────────────────
  const LOGO_BASE = 'https://raw.githubusercontent.com/SabbirHossainBorno/Justfun/master';
  const logoMap = {
    desco: `${LOGO_BASE}/DESCO.png`,
    dpdc: `${LOGO_BASE}/DPDC.png`,
    breb: `${LOGO_BASE}/BREB.png`,
    bpdb: `${LOGO_BASE}/BPDB.png`,
    nesco: `${LOGO_BASE}/NESCO.png`,
    wzpdcl: `${LOGO_BASE}/WZPDCL.png`,
  };
  const meterType = (user.meter_type || 'desco').toLowerCase();
  const logoUrl = logoMap[meterType] || logoMap.desco;

  // ─── Utility Provider Name ─────────────────────────────────────
  const providerMap = {
    desco: { name: 'DESCO', full: 'Dhaka Electricity Supply Co. PLC' },
    dpdc: { name: 'DPDC', full: 'Dhaka Power Distribution Company' },
    breb: { name: 'BREB', full: 'Bangladesh Rural Electrification Board' },
    bpdb: { name: 'BPDB', full: 'Bangladesh Power Development Board' },
    nesco: { name: 'NESCO', full: 'Northern Electricity Supply Co.' },
    wzpdcl: { name: 'WZPDCL', full: 'West Zone Power Distribution Co.' },
  };
  const provider = providerMap[meterType] || providerMap.desco;

  // ─── Token Format ──────────────────────────────────────────────
  const formattedToken = tokenNo ? tokenNo.replace(/(.{4})/g, '$1 ').trim() : null;

  // ─── Charge Items Parse ────────────────────────────────────────
  let demandCharge = 0;
  let meterRent = 0;
  chargeItems.forEach((item) => {
    if (item.chargeItemName === 'Demand Charge') demandCharge = item.chargeAmount;
    if (item.chargeItemName === 'Meter Rent 1P' || item.chargeItemName === 'Meter Rent') {
      meterRent = item.chargeAmount;
    }
  });

  const vatAmount = VAT || 0;
  const rebateAmount = rebate || 0;
  const frontendUrl = process.env.FRONTEND_URL || 'https://meterbondhu.com';

  // ─── Small helper: a bulletproof two-column row (label ⟷ value) ────────
  // Every row is its own tiny table with a fixed left-column width, so the
  // right-aligned values line up in a straight column no matter which
  // conditional rows happen to render above or below it.
  const row = (label, value, opts = {}) => {
    const { bold = false, color = '#000000', labelColor = '#555555' } = opts;
    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
        <tr>
          <td width="52%" align="left" style="font-family:'Courier New',Consolas,monospace; font-size:11px; color:${labelColor}; padding:3px 0; vertical-align:top;">${label}</td>
          <td width="48%" align="right" style="font-family:'Courier New',Consolas,monospace; font-size:11px; color:${color}; font-weight:${bold ? '700' : '600'}; padding:3px 0; vertical-align:top; word-break:break-word;">${value}</td>
        </tr>
      </table>`;
  };

  // ─── Perforated strip (progressive enhancement) ─────────────────────────
  // Solid background-color is declared first as the fallback for clients
  // that don't understand repeating-linear-gradient (classic Outlook), so
  // they get a clean flat strip instead of a broken/blank one.
  const perforatedStrip = `
    <tr>
      <td height="10" style="height:10px; line-height:10px; font-size:0; background-color:#eeeeee; background-image:repeating-linear-gradient(135deg, #ffffff 0, #ffffff 6px, transparent 6px, transparent 12px), repeating-linear-gradient(45deg, #ffffff 0, #ffffff 6px, transparent 6px, transparent 12px); background-repeat:repeat-x;">&nbsp;</td>
    </tr>`;

  const sectionTitle = (text) => `
    <tr><td align="center" style="padding:12px 0 6px; font-family:'Courier New',Consolas,monospace; font-size:10px; font-weight:700; letter-spacing:2.5px; color:#000000; text-transform:uppercase;">${text}</td></tr>`;

  const dashedDivider = `
    <tr><td style="border-top:1px dashed #b0b0b0; font-size:0; line-height:0; padding:0; margin:0;">&nbsp;</td></tr>`;

  const solidDivider = `
    <tr><td style="border-top:1.5px solid #000000; font-size:0; line-height:0; padding:0; margin:0;">&nbsp;</td></tr>`;

  const spacer = (h) => `<tr><td style="height:${h}px; line-height:${h}px; font-size:0;">&nbsp;</td></tr>`;

  return `
<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Recharge Receipt - ${provider.name}</title>
<!--[if mso]>
<style>
  table, td { font-family: 'Courier New', monospace !important; }
</style>
<![endif]-->
<style>
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
  img { -ms-interpolation-mode: bicubic; border: 0; line-height: 100%; outline: none; text-decoration: none; }
  body { margin: 0; padding: 0; width: 100% !important; background-color: #ececec; }

  .btn-primary   { background-color: #2563eb; background-image: linear-gradient(135deg, #3b82f6, #2563eb); }
  .btn-secondary { background-color: #ffffff; }

  @media only screen and (max-width: 440px) {
    .receipt-wrap { width: 100% !important; }
    .content-pad  { padding-left: 18px !important; padding-right: 18px !important; }
    .total-amount { font-size: 32px !important; }
    .btn-stack     { display: block !important; width: 100% !important; margin: 6px 0 !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#ececec;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ececec">
    <tr>
      <td align="center" style="padding:28px 12px;">

        <!-- ═══════════════════════════ RECEIPT CARD ═══════════════════════════ -->
        <table role="presentation" class="receipt-wrap" width="420" cellpadding="0" cellspacing="0" border="0" style="width:420px; max-width:420px;">
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff; border:1px solid #e6e6e6; border-radius:8px;">

                ${perforatedStrip}

                <tr>
                  <td class="content-pad" style="padding:26px 28px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

                      <!-- ─── Header: logo + provider ─────────────────────── -->
                      <tr>
                        <td align="center" style="padding-bottom:14px;">
                          <img src="${logoUrl}" width="64" height="64" alt="${provider.name}" style="display:block; margin:0 auto 8px; width:64px; height:64px; object-fit:contain;" />
                          <div style="font-family:'Courier New',Consolas,monospace; font-size:17px; font-weight:900; letter-spacing:1.5px; color:#000000; text-transform:uppercase;">${provider.name} PREPAID</div>
                          <div style="font-family:'Courier New',Consolas,monospace; font-size:9px; letter-spacing:0.3px; color:#555555; margin-top:3px;">${provider.full}</div>
                        </td>
                      </tr>

                      ${dashedDivider}
                      ${spacer(10)}

                      ${row('RECEIPT NO', orderID ? orderID.slice(-10) : 'N/A')}
                      ${row('DATE', formattedDate)}
                      ${row('TIME', formattedTime)}

                      ${spacer(10)}

                      <!-- ─── Status pill ──────────────────────────────────── -->
                      <tr>
                        <td align="center" style="padding:6px 0 4px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td align="center" bgcolor="${isSuccess ? '#ecfdf5' : '#fffbeb'}" style="background-color:${isSuccess ? '#ecfdf5' : '#fffbeb'}; border:1.5px solid ${isSuccess ? '#047857' : '#b45309'}; border-radius:20px; padding:8px 22px; font-family:'Courier New',Consolas,monospace; font-size:11px; font-weight:900; letter-spacing:1.5px; color:${isSuccess ? '#047857' : '#b45309'}; text-transform:uppercase; white-space:nowrap;">
                                ${isSuccess ? '&#9733; SUCCESSFUL &#9733;' : '&#8987; PENDING &#8987;'}
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      ${spacer(6)}
                      ${dashedDivider}
                      ${sectionTitle('Customer')}

                      ${row('Name', user.full_name || 'N/A')}
                      ${row('Account No', user.account_no)}
                      ${row('Meter No', user.meter_no)}
                      ${row('Member ID', user.m_bondhu_id)}

                      ${dashedDivider}

                      <!-- ─── Total amount (hero) ──────────────────────────── -->
                      <tr>
                        <td align="center" style="padding:16px 0 6px;">
                          <div style="font-family:'Courier New',Consolas,monospace; font-size:9px; font-weight:700; letter-spacing:3px; color:#555555; text-transform:uppercase;">Total Paid</div>
                          <div class="total-amount" style="font-family:'Courier New',Consolas,monospace; font-size:38px; font-weight:900; letter-spacing:-1.5px; color:#000000; line-height:1.1; margin-top:4px;">
                            <span style="font-size:22px; font-weight:700; color:#444444;">&#2547;</span>${(totalAmount || 0).toFixed(2)}
                          </div>
                          <div style="font-family:'Courier New',Consolas,monospace; font-size:9px; font-weight:700; letter-spacing:1.5px; color:#047857; text-transform:uppercase; margin-top:6px;">&#10003; Payment Received</div>
                        </td>
                      </tr>

                      ${spacer(8)}
                      ${dashedDivider}
                      ${sectionTitle('Breakdown')}

                      ${row('Energy Cost', `&#2547;${(energyAmount || 0).toFixed(2)}`)}
                      ${demandCharge > 0 ? row('Demand Charge', `&#2547;${demandCharge.toFixed(2)}`) : ''}
                      ${meterRent > 0 ? row('Meter Rent', `&#2547;${meterRent.toFixed(2)}`) : ''}
                      ${vatAmount > 0 ? row('VAT (5%)', `&#2547;${vatAmount.toFixed(2)}`) : ''}
                      ${rebateAmount !== 0 ? row('Rebate', `- &#2547;${Math.abs(rebateAmount).toFixed(2)}`, { color: '#047857' }) : ''}
                      ${chargeAmount > 0 ? row('Other Charges', `&#2547;${chargeAmount.toFixed(2)}`) : ''}

                      ${spacer(4)}
                      ${solidDivider}
                      ${spacer(4)}

                      ${row(
                        '<span style="font-weight:900;">GROSS TOTAL</span>',
                        `<span style="font-size:13px; font-weight:900;">&#2547;${(totalAmount || 0).toFixed(2)}</span>`
                      )}

                      ${dashedDivider}
                      ${sectionTitle('Transaction')}

                      ${row('Order ID', orderID || 'N/A')}
                      ${row('Sequence', seqNo || 'N/A')}
                      ${row('Operator', rechargeOperator || provider.name)}

                      ${formattedToken ? `
                      ${dashedDivider}
                      <tr>
                        <td align="center" style="padding:14px 0 10px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                            <tr>
                              <td align="center" bgcolor="#fafafa" style="background-color:#fafafa; border:1.5px dashed #999999; border-radius:6px; padding:12px 10px;">
                                <div style="font-family:'Courier New',Consolas,monospace; font-size:9px; font-weight:700; letter-spacing:3px; color:#555555; text-transform:uppercase;">Recharge Token</div>
                                <div style="font-family:'Courier New',Consolas,monospace; font-size:16px; font-weight:900; letter-spacing:2px; color:#000000; margin-top:6px; word-break:break-all;">${formattedToken}</div>
                                <div style="font-family:'Courier New',Consolas,monospace; font-size:8px; color:#888888; letter-spacing:0.5px; text-transform:uppercase; margin-top:6px;">Enter this code in your meter</div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>` : ''}

                      ${dashedDivider}

                      <!-- ─── Footer ────────────────────────────────────────── -->
                      <tr>
                        <td align="center" style="padding:12px 0 2px;">
                          <div style="font-family:'Courier New',Consolas,monospace; font-size:11px; font-weight:900; letter-spacing:3px; color:#000000; margin-bottom:6px;">*** THANK YOU ***</div>
                          <div style="font-family:'Courier New',Consolas,monospace; font-size:9px; color:#777777; letter-spacing:0.8px;">REF ${(orderID || seqNo || '000000').slice(-12)}</div>
                          <div style="font-family:'Courier New',Consolas,monospace; font-size:9px; color:#555555; letter-spacing:0.3px; margin-top:6px; line-height:1.5;">Please keep this receipt for your records</div>
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>

                ${perforatedStrip}

              </table>
            </td>
          </tr>
        </table>
        <!-- ═══════════════════════════ EMAIL FOOTER ═══════════════════════════ -->
        <table role="presentation" width="420" cellpadding="0" cellspacing="0" border="0" class="receipt-wrap" style="width:420px; max-width:420px;">
          <tr>
            <td align="center" style="padding:18px 8px 4px; font-family:-apple-system,BlinkMacSystemFont,sans-serif; font-size:11px; color:#64748b; line-height:1.6;">
              &copy; 2026 MeterBondhu &bull; Powered by <a href="https://www.nexoraq.tech/" style="color:#3b82f6; text-decoration:none;">Nexoraq Tech</a>
              <div style="font-size:10px; color:#94a3b8; margin-top:4px;">Sent to ${user.email}</div>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>
  `;
}

// ─── Send "Add Alert Email" Verification OTP ──────────────────────────────
async sendAddEmailOTPEmail(user, targetEmail, otp) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Verify Alert Email</title>
<style>
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
  img { -ms-interpolation-mode: bicubic; border: 0; }
  body { margin: 0; padding: 0; width: 100% !important; background-color: #f1f5f9; }
  :root { color-scheme: light; supported-color-schemes: light; }
  [data-ogsc] .force-ink { color: #0f172a !important; }
  [data-ogsc] .force-card { background-color: #ffffff !important; }
  @media only screen and (max-width: 520px) {
    .email-wrap { width: 100% !important; }
    .content-pad { padding-left: 18px !important; padding-right: 18px !important; }
    .otp-code { font-size: 30px !important; letter-spacing: 6px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f1f5f9">
    <tr>
      <td align="center" style="padding:28px 12px;">

        <table role="presentation" class="email-wrap" width="540" cellpadding="0" cellspacing="0" border="0" style="width:540px; max-width:540px;">
          <tr>
            <td bgcolor="#ffffff" class="force-card" style="background-color:#ffffff; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">

              <!-- ═══ TOP ACCENT BAR (BLUE) ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td height="5" bgcolor="#2563eb" style="background-color:#2563eb; border-radius:12px 12px 0 0; font-size:0; line-height:5px;">&nbsp;</td></tr>
              </table>

              <!-- ═══ HEADER ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td class="content-pad" align="center" style="padding:32px 30px 20px;">
                  <div class="force-ink" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:30px; font-weight:900; color:#0f172a; letter-spacing:-0.8px;">Meter<span style="color:#2563eb;">Bondhu</span></div>
                  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:10.5px; font-weight:700; letter-spacing:3px; color:#64748b; text-transform:uppercase; margin-top:4px;">Verify Alert Email</div>

                  <!-- Badge pill -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px auto 0;">
                    <tr>
                      <td align="center" bgcolor="#eff6ff" style="background-color:#eff6ff; border:1.5px solid #bfdbfe; border-radius:22px; padding:8px 20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:11px; font-weight:900; letter-spacing:1.5px; color:#2563eb; white-space:nowrap;">
                        &#128231; ADD ALERT EMAIL
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>

              <!-- ═══ GREETING ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td class="content-pad" style="padding:0 30px 4px;">
                  <div class="force-ink" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:20px; font-weight:800; color:#0f172a; letter-spacing:-0.3px; line-height:1.3;">
                    Hello, <span style="color:#2563eb;">${user.full_name}</span>! &#128075;
                  </div>
                  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:13.5px; color:#64748b; margin-top:10px; line-height:1.7;">
                    You requested to add <strong style="color:#2563eb;">${targetEmail}</strong> as an alert email. Use the verification code below to confirm this action.
                  </div>
                </td></tr>
              </table>

              <!-- ═══ OTP BOX ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td class="content-pad" style="padding:16px 30px 0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#eff6ff" style="background-color:#eff6ff; border:2px dashed #bfdbfe; border-radius:10px;">
                    <tr>
                      <td align="center" style="padding:24px 20px;">
                        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:10.5px; font-weight:800; letter-spacing:2.5px; color:#2563eb; text-transform:uppercase;">Verification Code</div>
                        <div class="otp-code" style="font-family:'Courier New',Consolas,monospace; font-size:38px; font-weight:900; color:#2563eb; letter-spacing:10px; margin-top:10px; word-break:break-all;">${otp}</div>
                        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:11.5px; color:#64748b; margin-top:12px;">&#8987; This code is valid for 1 minutes</div>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>

              <!-- ═══ WARNING BOX ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td class="content-pad" style="padding:14px 30px 0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fffbeb" style="background-color:#fffbeb; border:1px solid #fde68a; border-radius:8px;">
                    <tr><td style="padding:14px 16px;">
                      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12px; font-weight:700; color:#b45309; margin-bottom:4px;">
                        &#9888; Security Notice
                      </div>
                      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:#78350f; line-height:1.6;">
                        If you didn't request this, please ignore this email and DO NOT share the code with anyone.
                      </div>
                    </td></tr>
                  </table>
                </td></tr>
              </table>

              <!-- ═══ FOOTER ═══ -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td class="content-pad" align="center" style="padding:22px 30px 26px;">
                  <div style="border-top:1px solid #e2e8f0; padding-top:18px; width:100%;">
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12px; color:#64748b; line-height:1.6;">
                      &copy; 2026 MeterBondhu &bull; Powered by <a href="https://www.nexoraq.tech/" style="color:#2563eb; text-decoration:none;">Nexoraq Tech</a>
                    </div>
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:11px; color:#94a3b8; margin-top:6px;">
                      This email was sent to ${targetEmail}
                    </div>
                  </div>
                </td></tr>
              </table>

            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>
    `;

    const mailOptions = {
      from: `"MeterBondhu" <${process.env.EMAIL_FROM}>`,
      to: targetEmail,
      subject: '🔐 Verify Your Alert Email - MeterBondhu',
      html: html,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Add-email OTP sent to:', targetEmail);
      return true;
    } catch (error) {
      console.error('❌ Add-email OTP error:', error.message);
      return false;
    }
  }

// ─── Send Feedback Confirmation Email ───────────────────────────────────
async sendFeedbackConfirmationEmail(user, feedback, attachmentFilenames = []) {
  const html = this.getFeedbackConfirmationHTML(user, feedback, attachmentFilenames);

  const mailOptions = {
    from: `"MeterBondhu" <${process.env.EMAIL_FROM}>`,
    to: user.email,
    subject: `✅ Feedback Received — ${feedback.feedback_code}`,
    html,
  };

  try {
    await this.transporter.sendMail(mailOptions);
    console.log('✅ Feedback confirmation email sent to:', user.email);
    return true;
  } catch (error) {
    console.error('❌ Feedback email error:', error.message);
    return false;
  }
}

// ─── Feedback Confirmation HTML ─────────────────────────────────────────
getFeedbackConfirmationHTML(user, feedback, attachmentFilenames) {
  const priorityColors = {
    low: { bg: '#f1f5f9', border: '#cbd5e1', text: '#475569', label: 'Low' },
    medium: { bg: '#eff6ff', border: '#bfdbfe', text: '#2563eb', label: 'Medium' },
    high: { bg: '#fff7ed', border: '#fed7aa', text: '#ea580c', label: 'High' },
    critical: { bg: '#fef2f2', border: '#fecaca', text: '#dc2626', label: 'Critical' },
  };
  const p = priorityColors[feedback.priority] || priorityColors.low;

  const createdDate = new Date(feedback.created_at).toLocaleString('en-US', {
    weekday: 'short', year: 'numeric', month: 'short',
    day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const kvRow = (label, value, opts = {}) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="40%" align="left" style="padding:4px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:13px; color:#64748b;">${label}</td>
        <td width="60%" align="right" style="padding:4px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:13px; color:#0f172a; font-weight:600; ${opts.bold ? 'font-weight:800;' : ''}">${value}</td>
      </tr>
    </table>`;

  const attachmentsHTML = attachmentFilenames.length > 0 ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:2px; margin:12px 0;">
      <tr>
        <td style="padding:14px 16px;">
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:11px; font-weight:700; letter-spacing:1px; color:#64748b; text-transform:uppercase; margin-bottom:8px;">
            📎 Attachments (${attachmentFilenames.length})
          </div>
          ${attachmentFilenames.map((f, i) => `
            <div style="font-family:'Courier New',Consolas,monospace; font-size:12px; color:#334155; padding:3px 0;">
              ${i + 1}. ${f}
            </div>`).join('')}
        </td>
      </tr>
    </table>` : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Feedback Received</title>
<style>
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
  body { margin: 0; padding: 0; width: 100% !important; background-color: #f1f5f9; }
</style>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f1f5f9">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">

  <tr><td bgcolor="#ffffff" style="background-color:#ffffff; border:1px solid #e2e8f0; border-radius:10px; overflow:hidden;">

    <!-- Top accent bar -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td height="4" bgcolor="#22c55e" style="background-color:#22c55e; font-size:0; line-height:4px;">&nbsp;</td></tr>
    </table>

    <!-- Header -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="padding:28px 30px 20px;">
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:28px; font-weight:800; color:#0f172a; letter-spacing:-0.5px;">Meter<span style="color:#2563eb;">Bondhu</span></div>
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#64748b; font-size:11px; letter-spacing:3px; text-transform:uppercase; margin-top:3px;">Feedback Received</div>
    </td></tr>
    </table>

    <!-- Success badge -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center" style="padding:0 30px 20px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center" bgcolor="#f0fdf4" style="background-color:#f0fdf4; border:2px solid #22c55e; border-radius:50px; padding:10px 26px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:13px; font-weight:800; letter-spacing:1px; color:#15803d;">
            ✓ THANK YOU
          </td>
        </tr>
      </table>
    </td></tr>
    </table>

    <!-- Greeting -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="padding:0 30px 6px;">
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:17px; font-weight:700; color:#0f172a;">Hi ${user.full_name} 👋</div>
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#64748b; font-size:13.5px; line-height:1.7; margin-top:8px;">
        Thank you for taking the time to share your feedback with us! We've received your message and our team will review it shortly.
      </div>
    </td></tr>
    </table>

    <!-- Reference card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="padding:18px 30px 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#eff6ff" style="background-color:#eff6ff; border:1px solid #bfdbfe; border-radius:8px;">
        <tr><td style="padding:16px 18px;">
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:10px; font-weight:800; letter-spacing:1.5px; color:#2563eb; text-transform:uppercase; margin-bottom:4px;">Reference ID</div>
          <div style="font-family:'Courier New',Consolas,monospace; font-size:20px; font-weight:900; color:#1e40af; letter-spacing:1px;">${feedback.feedback_code}</div>
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:11.5px; color:#64748b; margin-top:6px;">Submitted on ${createdDate}</div>
        </td></tr>
      </table>
    </td></tr>
    </table>

    <!-- Details -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="padding:12px 30px 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;">
        <tr><td style="padding:16px 18px;">
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:10px; font-weight:800; letter-spacing:1.5px; color:#64748b; text-transform:uppercase; margin-bottom:10px;">Your Feedback Details</div>

          ${kvRow('📌 Title', feedback.title)}
          ${kvRow('📄 Page', feedback.page_name)}
          ${kvRow('⚡ Priority',
            `<span style="display:inline-block; background-color:${p.bg}; border:1px solid ${p.border}; color:${p.text}; padding:2px 10px; border-radius:4px; font-size:11px; font-weight:800; letter-spacing:0.5px; text-transform:uppercase;">${p.label}</span>`
          )}

          <div style="border-top:1px solid #e2e8f0; margin:10px 0 10px;"></div>

          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:11px; color:#64748b; margin-bottom:6px;">Description</div>
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:13px; color:#0f172a; line-height:1.6; white-space:pre-wrap;">${feedback.description}</div>
        </td></tr>
      </table>
    </td></tr>
    </table>

    <!-- Attachments -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="padding:0 30px;">
      ${attachmentsHTML}
    </td></tr>
    </table>

    <!-- What's next -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="padding:16px 30px 6px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fffbeb" style="background-color:#fffbeb; border:1px solid #fde68a; border-radius:8px;">
        <tr><td style="padding:14px 18px;">
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:13px; font-weight:700; color:#b45309; margin-bottom:6px;">⏭️ What Happens Next?</div>
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:#64748b; line-height:1.7;">
            Our team will review your feedback within 24&ndash;48 hours. If we need more details, we'll reach out to you at this email address. You may also receive a notification when we update the status.
          </div>
        </td></tr>
      </table>
    </td></tr>
    </table>

    <!-- Footer -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center" style="padding:22px 30px 26px;">
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#64748b; font-size:12px; padding-top:16px; border-top:1px solid #e2e8f0; width:100%;">
        © 2026 MeterBondhu • Powered by <a href="https://www.nexoraq.tech/" style="color:#2563eb; text-decoration:none;">Nexoraq Tech</a>
      </div>
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#94a3b8; font-size:11px; margin-top:6px;">
        Sent to ${user.email}
      </div>
    </td></tr>
    </table>

  </td></tr>
</table>
</td></tr>
</table>

</body>
</html>`;
}

// ─── ALERT EMAIL HTML (RESPONSIVE, TABLE-BASED, LIGHT THEME) ────────────
getAlertEmailHTML(user, alertData) {
  const balance = parseFloat(alertData.balance) || 0;
  const threshold = parseFloat(alertData.threshold) || 100;
  const meterNo = alertData.meterNo || user.meter_no || 'N/A';
  const dailyAvgCost = parseFloat(alertData.dailyAvgCost) || 50;
  const suggestionAmount = parseFloat(alertData.suggestionAmount) || 0;
  const isCritical = alertData.isCritical || false;
  const monthlyBreakdown = alertData.monthlyBreakdown || [];
  const daysLeft = Math.floor(balance / dailyAvgCost);
  const currentMonthRecharge = parseFloat(alertData.currentMonthRecharge) || 0;
  const currentMonthEnergy = parseFloat(alertData.currentMonthEnergy) || 0;
  const netEnergyNeeded = parseFloat(alertData.netEnergyNeeded) || 0;
  const totalRechargeNeeded = parseFloat(alertData.totalRechargeNeeded) || 0;
  const avgEnergyPercentage = parseFloat(alertData.avgEnergyPercentage) || 0.803;
  const avgEnergyNeeded = parseFloat(alertData.avgEnergyNeeded) || 0;
  const projectedBalanceInfo = alertData.projectedBalanceInfo || null;

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  // ─── Palette (light theme, on purpose) ──────────────────────────────
  // A dark-themed email is the design most likely to get mangled by
  // clients' automatic "dark mode" reprocessing (Gmail, Outlook.com,
  // Apple Mail): if an element doesn't carry its OWN explicit
  // background-color, the client can re-color its text independently of
  // its (dark) inherited background — that's exactly how you get black
  // text on a black box. A light theme, combined with the
  // color-scheme/supported-color-schemes meta tags below (telling
  // clients this email is light-only and to leave it alone) and an
  // explicit bgcolor on every colored element here, sidesteps that
  // failure mode almost entirely — it's also why virtually every
  // bank/SaaS transactional email uses a light theme.
  const ink = '#0f172a';
  const muted = '#64748b';
  const dangerText = isCritical ? '#b91c1c' : '#dc2626';
  const dangerBg = isCritical ? '#fee2e2' : '#fef2f2';
  const dangerBorder = isCritical ? '#fca5a5' : '#fecaca';

  // ─── Helpers (all table-based — no flex/grid, so Outlook & Gmail app
  // render these identically to every other client) ───────────────────

  // Two-column "label ⟷ value" row. Every row shares the same 58/42
  // column split so values line up in a straight column.
  const kvRow = (label, value, opts = {}) => {
    const { valueColor = ink, bold = false, indent = false, topBorder = false, size = 13 } = opts;
    const topStyle = topBorder ? 'border-top:1px solid #e2e8f0; padding-top:8px;' : '';
    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
        <tr>
          <td width="58%" align="left" style="padding:${topBorder ? '8px' : '3px'} 0 3px; ${topStyle} font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:${size}px; color:${indent ? '#94a3b8' : muted}; ${indent ? 'padding-left:16px;' : ''} font-weight:${bold ? '600' : '400'};">${label}</td>
          <td width="42%" align="right" style="padding:${topBorder ? '8px' : '3px'} 0 3px; ${topStyle} font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:${size}px; color:${valueColor}; font-weight:${bold ? '700' : '500'};">${value}</td>
        </tr>
      </table>`;
  };

  // Icon + title bar (inline-block + vertical-align instead of flex —
  // renders correctly everywhere flex would silently fail).
  const iconTitle = (icon, text, color) => `
    <span style="display:inline-block; vertical-align:middle; font-size:16px; margin-right:8px; line-height:1;">${icon}</span><span style="display:inline-block; vertical-align:middle; color:${color}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:14px; font-weight:600;">${text}</span>`;

  const boxWrap = (innerHtml, { bg = '#f8fafc', border = '#e2e8f0' } = {}) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${bg}" style="background-color:${bg}; border:1px solid ${border}; border-radius:2px; margin:14px 0;">
      <tr><td style="padding:16px 18px;">${innerHtml}</td></tr>
    </table>`;

  // ─── Projected balance explanation ──────────────────────────────────
  let projectedHTML = '';
  if (projectedBalanceInfo && !projectedBalanceInfo.isSafe) {
    const p = projectedBalanceInfo;
    const inner = `
      ${iconTitle('&#128202;', 'Why This Alert Was Sent Even After Recharge', dangerText)}
      <div style="margin-top:10px; background-color:#ffffff; border-radius:2px; padding:10px 12px;">
        ${kvRow('Current Balance', `৳${p.currentBalance.toFixed(2)}`)}
        ${kvRow('Last Recharge', `+ ৳${p.rechargeAmount.toFixed(2)}`, { valueColor: '#16a34a' })}
        ${kvRow(`&#8618; Energy Received (${(p.energyPercentage * 100).toFixed(1)}%)`, `৳${p.rechargeEnergy.toFixed(2)}`, { indent: true, size: 11, valueColor: '#94a3b8' })}
        ${kvRow('Daily Avg Consumption', `- ৳${p.dailyAvgCost.toFixed(2)}`, { valueColor: '#d97706' })}
        ${kvRow('Projected Balance', `৳${p.projectedBalance.toFixed(2)}`, { valueColor: dangerText, bold: true, topBorder: true })}
        ${kvRow('Your Threshold', `৳${p.threshold}`)}
      </div>
      <div style="margin-top:10px; padding-top:10px; border-top:1px solid ${dangerBorder}; color:${dangerText}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12px; line-height:1.6;">
        &#9888; Even after your recent recharge, the projected balance is still below your threshold. Please recharge again soon.
      </div>`;
    projectedHTML = boxWrap(inner, { bg: dangerBg, border: dangerBorder });
  }

  // ─── Monthly breakdown ───────────────────────────────────────────────
  let breakdownHTML = '';
  if (monthlyBreakdown.length > 0) {
    const rows = monthlyBreakdown
      .map((item) => {
        const monthName = new Date(item.month + '-01').toLocaleString('default', { month: 'short', year: 'numeric' });
        const val = item.energyAmount ? item.energyAmount.toFixed(0) : item.cost.toFixed(0);
        return kvRow(monthName, `৳${val}`);
      })
      .join('');
    const inner = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:${muted}; font-size:11px; font-weight:600; letter-spacing:1px; text-transform:uppercase; margin-bottom:8px;">
        &#128202; Your Last 3 Months Energy Usage
      </div>
      ${rows}
      ${kvRow('&#128200; Average Energy', `৳${avgEnergyNeeded.toFixed(0)}/month`, { bold: true, valueColor: '#b45309', topBorder: true })}`;
    breakdownHTML = boxWrap(inner, { bg: '#fffbeb', border: '#fde68a' });
  }

  // ─── Suggestion box ──────────────────────────────────────────────────
  const energyPercent = (avgEnergyPercentage * 100).toFixed(1);
  let suggestionHTML = '';

  if (suggestionAmount > 0) {
    const calcRows = `
      ${kvRow('Average Energy Needed', `৳${avgEnergyNeeded.toFixed(0)}/month`)}
      ${currentMonthRecharge > 0 ? `
        ${kvRow('Already Recharged This Month', `৳${currentMonthRecharge.toFixed(0)}`)}
        ${kvRow(`&#8618; Energy Received (${energyPercent}%)`, `৳${currentMonthEnergy.toFixed(0)}`, { indent: true, size: 11, valueColor: '#94a3b8' })}
        ${kvRow('Net Energy Needed', `৳${netEnergyNeeded.toFixed(0)}`, { valueColor: '#b45309', bold: true, topBorder: true })}
      ` : ''}
      ${kvRow('Energy Conversion Rate', `${energyPercent}%`)}
      ${kvRow('Total Recharge Needed', `৳${totalRechargeNeeded.toFixed(0)}`, { valueColor: '#b45309', bold: true, topBorder: true })}`;

    const inner = `
      ${iconTitle('&#128161;', 'MeterBondhu Suggestion', '#2563eb')}
      <div style="margin-top:8px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:${muted}; font-size:13px; line-height:1.7;">
        Based on your last 3 months usage, you need approximately <span style="color:#b45309; font-weight:600;">৳${avgEnergyNeeded.toFixed(0)}</span> energy per month.
      </div>
      <div style="margin-top:8px; background-color:#ffffff; border-radius:2px; padding:10px 12px;">
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:${muted}; font-size:11px; font-weight:600; letter-spacing:0.5px; margin-bottom:6px;">&#128221; Calculation Breakdown</div>
        ${calcRows}
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f0fdf4" style="background-color:#f0fdf4; border:1px solid #bbf7d0; border-radius:2px; margin-top:10px;">
        <tr>
          <td align="center" style="padding:12px;">
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:${muted}; font-size:12px;">We suggest you recharge</div>
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#16a34a; font-size:26px; font-weight:800; margin-top:2px;">৳${suggestionAmount}</div>
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:${muted}; font-size:11px; margin-top:4px;">
              (This will add approximately <span style="color:#16a34a; font-weight:600;">৳${(suggestionAmount * avgEnergyPercentage).toFixed(0)}</span> energy to your meter)
            </div>
          </td>
        </tr>
      </table>`;
    suggestionHTML = boxWrap(inner, { bg: '#eff6ff', border: '#bfdbfe' });
  } else {
    const inner = `
      ${iconTitle('&#9989;', 'All Set!', '#16a34a')}
      <div style="margin-top:6px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:${muted}; font-size:13px; line-height:1.7;">
        You have already recharged <span style="color:#16a34a; font-weight:600;">৳${currentMonthRecharge.toFixed(0)}</span> this month, which covers your average monthly energy need of <span style="color:#b45309; font-weight:600;">৳${avgEnergyNeeded.toFixed(0)}</span>. No additional recharge needed at this time.
      </div>`;
    suggestionHTML = boxWrap(inner, { bg: '#f0fdf4', border: '#bbf7d0' });
  }

  return `
<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<!-- Tell clients this email is light-only so they skip auto dark-mode
     reprocessing instead of selectively re-coloring elements on top of
     our own colors (the cause of the black-on-black text issue). -->
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${isCritical ? '🔴 CRITICAL' : '⚠️'} Low Balance Alert</title>
<style>
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
  img { -ms-interpolation-mode: bicubic; border: 0; }
  body { margin: 0; padding: 0; width: 100% !important; background-color: #f1f5f9; }

  /* Belt-and-braces: force our colors even if a client still tries to
     dark-mode this despite the meta tags above. */
  :root { color-scheme: light; supported-color-schemes: light; }
  [data-ogsc] .force-ink { color: #0f172a !important; }
  [data-ogsc] .force-card { background-color: #ffffff !important; }

  @media only screen and (max-width: 480px) {
    .email-wrap { width: 100% !important; }
    .content-pad { padding-left: 18px !important; padding-right: 18px !important; }
    .balance-amount { font-size: 32px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f1f5f9">
    <tr>
      <td align="center" style="padding:24px 12px;">

        <table role="presentation" class="email-wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">
          <tr>
            <td bgcolor="#ffffff" class="force-card" style="background-color:#ffffff; border:1px solid #e2e8f0; border-radius:2px;">

              <!-- top accent bar -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td height="4" bgcolor="${dangerText}" style="background-color:${dangerText}; border-radius:2px 2px 0 0; font-size:0; line-height:4px;">&nbsp;</td></tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
              <td class="content-pad" style="padding:0 30px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

                <!-- ─── Header ─────────────────────────────────────────── -->
                <tr>
                  <td align="center" style="padding:28px 0 20px; border-bottom:1px solid #e2e8f0;">
                    <div class="force-ink" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:28px; font-weight:800; color:${ink}; letter-spacing:-0.5px;">Meter<span style="color:#2563eb;">Bondhu</span></div>
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:${muted}; font-size:11px; letter-spacing:3px; text-transform:uppercase; margin-top:3px;">DESCO Smart Meter Monitor</div>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:12px auto 0;">
                      <tr>
                        <td align="center" bgcolor="${dangerBg}" style="background-color:${dangerBg}; border:1px solid ${dangerBorder}; border-radius:2px; padding:6px 18px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:11px; font-weight:700; letter-spacing:1px; color:${dangerText}; white-space:nowrap;">
                          ${isCritical ? '&#128308; CRITICAL &mdash; RECHARGE NOW' : '&#9888; LOW BALANCE'}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- ─── Greeting + warning ─────────────────────────────── -->
                <tr>
                  <td style="padding:24px 0 4px;">
                    <div class="force-ink" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:19px; font-weight:700; color:${ink};">Hello, <span style="color:#2563eb;">${user.full_name}</span> &#128075;</div>
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:${dangerText}; font-size:14px; margin-top:8px; line-height:1.7;">
                      ${isCritical
                        ? '&#128308; Your DESCO prepaid balance is critically low! Your electricity may run out within the next 1&ndash;2 hours. Please recharge immediately to avoid service interruption.'
                        : '&#9889; Your DESCO prepaid balance is running low. We recommend recharging soon to avoid service interruption.'}
                    </div>
                  </td>
                </tr>

                <!-- ─── Balance hero ───────────────────────────────────── -->
                <tr>
                  <td style="padding:8px 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${dangerBg}" style="background-color:${dangerBg}; border:1px solid ${dangerBorder}; border-radius:2px;">
                      <tr>
                        <td align="center" style="padding:22px 20px;">
                          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:${muted}; font-size:12px; font-weight:600; letter-spacing:2px; text-transform:uppercase;">Current Balance</div>
                          <div class="balance-amount" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:40px; font-weight:800; color:${dangerText}; letter-spacing:-1px; margin-top:4px;">
                            <span style="font-size:22px; color:${muted}; font-weight:700;">৳</span>${balance.toFixed(2)}
                          </div>
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px auto 0;">
                            <tr>
                              <td align="center" bgcolor="#ffffff" style="background-color:#ffffff; border:1px solid ${dangerBorder}; border-radius:2px; padding:4px 14px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:11px; font-weight:700; color:${dangerText}; white-space:nowrap;">
                                ${isCritical ? '&#128308; CRITICAL &mdash; BELOW DAILY AVG' : `&#9888; BELOW THRESHOLD (&#2547;${threshold})`}
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- ─── Account / usage summary ─────────────────────────── -->
                <tr>
                  <td style="padding:8px 0;">
                    ${boxWrap(
                      `${kvRow('&#128203; Account Number', user.account_no, { bold: true, size: 13.5 })}
                      ${kvRow('&#128290; Meter Number', meterNo, { bold: true, size: 13.5 })}
                      ${kvRow('&#9889; Daily Avg. Cost', `৳${dailyAvgCost.toFixed(0)}`, { bold: true, size: 13.5, valueColor: isCritical ? '#dc2626' : '#b45309' })}
                      ${kvRow('&#8987; Days Remaining', daysLeft > 0 ? `${daysLeft} days` : '&#9888; Less than 1 day', { bold: true, size: 13.5, valueColor: daysLeft < 1 ? '#dc2626' : '#b45309' })}
                      ${kvRow('&#128197; Last Updated', `${currentDate} at ${currentTime}`, { size: 12, topBorder: true })}`,
                      { bg: '#f8fafc', border: '#e2e8f0' }
                    )}
                  </td>
                </tr>

                <!-- ─── What this means ─────────────────────────────────── -->
                <tr>
                  <td>
                    ${boxWrap(
                      `${iconTitle('&#9888;', 'What This Means', '#b45309')}
                      <div style="margin-top:6px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:${muted}; font-size:13px; line-height:1.7;">
                        You have been using approximately <span style="color:${dangerText}; font-weight:600;">৳${dailyAvgCost.toFixed(0)}</span> per day on average.
                        At this rate, your current balance of <span style="color:${dangerText}; font-weight:600;">৳${balance.toFixed(2)}</span> will last approximately
                        <span style="color:${dangerText}; font-weight:600;">${daysLeft > 0 ? `${daysLeft} days` : 'less than 1 day'}</span>.
                        ${isCritical ? '<br><br>&#128308; <strong>URGENT:</strong> Your balance is less than your daily average consumption. Please recharge immediately!' : ''}
                      </div>`,
                      { bg: '#fffbeb', border: '#fde68a' }
                    )}
                  </td>
                </tr>

                <tr><td>${breakdownHTML}</td></tr>
                <tr><td>${suggestionHTML}</td></tr>
                <tr><td>${projectedHTML}</td></tr>

                <!-- ─── Footer ──────────────────────────────────────────── -->
                <tr>
                  <td align="center" style="padding:22px 0 26px; border-top:1px solid #e2e8f0; margin-top:12px;">
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:${muted}; font-size:12px; padding-top:18px;">
                      &copy; 2026 MeterBondhu &bull; Powered by <a href="https://www.nexoraq.tech/" style="color:#2563eb; text-decoration:none;">Nexoraq Tech</a>
                    </div>
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#94a3b8; font-size:11px; margin-top:4px;">
                      This alert was sent to ${user.email} &bull; ${currentDate}
                    </div>
                  </td>
                </tr>

              </table>
              </td>
              </tr>
              </table>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>
  `;
}

  // ─── Daily Report Email HTML ─────────────────────────────────────────────
  getDailyReportHTML(user, reportData) {
  const {
    reportDate = new Date(Date.now() - 24 * 60 * 60 * 1000),  // yesterday
    yesterdayUsageTaka = 0,
    yesterdayUsageUnit = 0,
    hasUnit = false,                    // system-B → false
    yesterdayRechargeTaka = 0,
    yesterdayRechargeCount = 0,
    currentBalance = 0,
    balanceThreshold = 0,
    dailyAvgCost = 0,
    avgDailyUnit = 0,
    monthUsageTaka = 0,
    monthUsageUnit = 0,
    monthRechargeTaka = 0,
    last7Days = [],                     // [{ date, taka, unit }]
    highestPeak = null,                 // { date, taka, unit, isYesterday }
    isSystemB = false,
    meterType = 'desco',
  } = reportData;

  const providerMap = {
    desco: { name: 'DESCO', full: 'Dhaka Electricity Supply Co. PLC' },
    dpdc: { name: 'DPDC', full: 'Dhaka Power Distribution Company' },
    breb: { name: 'BREB', full: 'Bangladesh Rural Electrification Board' },
    bpdb: { name: 'BPDB', full: 'Bangladesh Power Development Board' },
    nesco: { name: 'NESCO', full: 'Northern Electricity Supply Co.' },
    wzpdcl: { name: 'WZPDCL', full: 'West Zone Power Distribution Co.' },
  };
  const provider = providerMap[meterType?.toLowerCase()] || providerMap.desco;

  const LOGO_BASE = 'https://raw.githubusercontent.com/SabbirHossainBorno/Justfun/master';
  const logoMap = {
    desco: `${LOGO_BASE}/DESCO.png`,
    dpdc: `${LOGO_BASE}/DPDC.png`,
    breb: `${LOGO_BASE}/BREB.png`,
    bpdb: `${LOGO_BASE}/BPDB.png`,
    nesco: `${LOGO_BASE}/NESCO.png`,
    wzpdcl: `${LOGO_BASE}/WZPDCL.png`,
  };
  const logoUrl = logoMap[meterType?.toLowerCase()] || logoMap.desco;

  const frontendUrl = process.env.FRONTEND_URL || 'https://meterbondhu.com';

  const formattedReportDate = reportDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // ─── Balance status ─────────────────────────────────────────────────
  const balanceRatio = dailyAvgCost > 0 ? currentBalance / dailyAvgCost : 999;
  const balanceStatus = (() => {
    if (currentBalance <= 0) {
      return { key: 'empty', label: 'EMPTY', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: '🔴' };
    }
    if (balanceRatio < 1) {
      return { key: 'critical', label: 'CRITICAL', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: '🔴' };
    }
    if (balanceThreshold > 0 && currentBalance < balanceThreshold) {
      return { key: 'low', label: 'LOW', color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: '⚠️' };
    }
    if (balanceRatio < 3) {
      return { key: 'moderate', label: 'MODERATE', color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: '🟡' };
    }
    return { key: 'healthy', label: 'HEALTHY', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', icon: '✅' };
  })();

  const daysLeft = dailyAvgCost > 0 ? Math.floor(currentBalance / dailyAvgCost) : null;

  // ─── Highest peak detection ─────────────────────────────────────────
  const isYesterdayHighest = highestPeak?.isYesterday || false;

// ═══════════════════════════════════════════════════════════════════════
// ✅ Suggested Top-up Logic (FIXED)
// ═══════════════════════════════════════════════════════════════════════
// Rules:
//   1. Balance covers ≥ 1 day of usage → no top-up needed (0)
//   2. Balance < 1 day → suggest enough to cover 3 days buffer
//   3. No usage history (dailyAvgCost = 0) → no top-up
// ═══════════════════════════════════════════════════════════════════════
const suggestedTopup = (() => {
  if (dailyAvgCost <= 0) return 0;

  const daysOfBalanceLeft = currentBalance / dailyAvgCost;

  // ✅ 1 day or more buffer → safe, no top-up
  if (daysOfBalanceLeft >= 1) return 0;

  // ✅ Below 1 day → top-up to 3 days buffer
  const targetBalance = dailyAvgCost * 3;
  const needed = Math.max(0, targetBalance - currentBalance);
  return Math.ceil(needed / 100) * 100;
})();

  // ─── Helpers ────────────────────────────────────────────────────────
  const ink = '#0f172a';
  const muted = '#64748b';
  const brandBlue = '#2563eb';

  const kvRow = (label, value, opts = {}) => {
    const { valueColor = ink, bold = false, topBorder = false, size = 13 } = opts;
    const topStyle = topBorder ? 'border-top:1px solid #e2e8f0; padding-top:10px; margin-top:2px;' : '';
    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
        <tr>
          <td width="58%" align="left" style="padding:${topBorder ? '10px' : '4px'} 0 4px; ${topStyle} font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:${size}px; color:${muted}; font-weight:${bold ? '600' : '400'};">${label}</td>
          <td width="42%" align="right" style="padding:${topBorder ? '10px' : '4px'} 0 4px; ${topStyle} font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:${size}px; color:${valueColor}; font-weight:${bold ? '700' : '500'};">${value}</td>
        </tr>
      </table>`;
  };

  const boxWrap = (inner, { bg = '#f8fafc', border = '#e2e8f0' } = {}) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${bg}" style="background-color:${bg}; border:1px solid ${border}; margin:14px 0;">
      <tr><td style="padding:16px 18px;">${inner}</td></tr>
    </table>`;

  const sectionTitle = (icon, text, color = '#64748b') => `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:10.5px; font-weight:800; letter-spacing:1.5px; color:${color}; text-transform:uppercase; padding-bottom:10px;">
      ${icon} ${text}
    </div>`;

  // ─── Mini bar chart for last 7 days ─────────────────────────────────
  let chartHTML = '';
  if (last7Days.length > 0) {
    const maxTaka = Math.max(...last7Days.map((d) => d.taka), 1);
    const bars = last7Days.map((d) => {
      const pct = (d.taka / maxTaka) * 100;
      const isYesterday = d.isYesterday || false;
      const dayLabel = new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' });
      const barColor = isYesterday ? '#2563eb' : '#94a3b8';
      return `
        <td align="center" valign="bottom" style="padding:0 2px; vertical-align:bottom;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
            <tr>
              <td align="center" valign="bottom" style="height:70px; vertical-align:bottom; padding-bottom:4px;">
                <div style="background-color:${barColor}; width:70%; height:${Math.max(pct, 4)}%; min-height:4px; border-radius:3px 3px 0 0; margin:0 auto;"></div>
              </td>
            </tr>
            <tr>
              <td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:9px; font-weight:${isYesterday ? '800' : '600'}; color:${isYesterday ? brandBlue : muted}; padding-top:4px;">
                ${dayLabel}
              </td>
            </tr>
            <tr>
              <td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:8.5px; color:${muted}; padding-top:1px;">
                ৳${d.taka.toFixed(0)}
              </td>
            </tr>
          </table>
        </td>`;
    }).join('');

    chartHTML = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; table-layout:fixed;">
        <tr>${bars}</tr>
      </table>`;
  }

  // ─── Peak warning banner ────────────────────────────────────────────
  const peakBannerHTML = isYesterdayHighest ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fff7ed" style="background-color:#fff7ed; border:1px solid #fed7aa; margin:0 0 14px;">
      <tr>
        <td style="padding:14px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="30" valign="middle" style="font-size:20px; line-height:1;">📈</td>
              <td valign="middle" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:#9a3412; line-height:1.5;">
                <strong style="font-size:13.5px;">N:B &mdash; Highest Peak!</strong><br>
                Yesterday's consumption was your <strong>highest</strong> in the last 30 days. That's <strong>৳${yesterdayUsageTaka.toFixed(0)}</strong>${hasUnit ? ` (${yesterdayUsageUnit.toFixed(1)} kWh)` : ''} in a single day.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>` : '';

  // ─── Suggestion banner ──────────────────────────────────────────────
  const suggestionBannerHTML = suggestedTopup > 0 ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#eff6ff" style="background-color:#eff6ff; border:1px solid #bfdbfe; margin:14px 0 0;">
      <tr>
        <td align="center" style="padding:18px 16px;">
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:11px; font-weight:800; letter-spacing:1.5px; color:${brandBlue}; text-transform:uppercase; margin-bottom:4px;">
            💡 Suggested Recharge
          </div>
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:32px; font-weight:900; color:${brandBlue}; letter-spacing:-1px; line-height:1.1;">
            ৳${suggestedTopup}
          </div>
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:11.5px; color:${muted}; margin-top:6px; line-height:1.5;">
            Keep ~3 days of buffer at your avg ৳${dailyAvgCost.toFixed(0)}/day consumption.
          </div>
        </td>
      </tr>
    </table>` : `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f0fdf4" style="background-color:#f0fdf4; border:1px solid #bbf7d0; margin:14px 0 0;">
      <tr>
        <td align="center" style="padding:14px 16px;">
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:13px; font-weight:700; color:#16a34a;">
            ✅ You're all set — no recharges needed right now.
          </div>
        </td>
      </tr>
    </table>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Daily Report — ${formattedReportDate}</title>
<style>
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
  img { -ms-interpolation-mode: bicubic; border: 0; }
  body { margin: 0; padding: 0; width: 100% !important; background-color: #f1f5f9; }
  :root { color-scheme: light; supported-color-schemes: light; }
  [data-ogsc] .force-ink { color: #0f172a !important; }
  [data-ogsc] .force-card { background-color: #ffffff !important; }
  @media only screen and (max-width: 520px) {
    .email-wrap { width: 100% !important; }
    .content-pad { padding-left: 18px !important; padding-right: 18px !important; }
    .hero-amount { font-size: 32px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f1f5f9">
  <tr>
    <td align="center" style="padding:28px 12px;">

      <table role="presentation" class="email-wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">
        <tr>
          <td bgcolor="#ffffff" class="force-card" style="background-color:#ffffff; border:1px solid #e2e8f0; overflow:hidden;">

            <!-- ═══ TOP ACCENT BAR ═══ -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td height="5" bgcolor="${brandBlue}" style="background-color:${brandBlue}; font-size:0; line-height:5px;">&nbsp;</td></tr>
            </table>

            <!-- ═══ HEADER ═══ -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td class="content-pad" align="center" style="padding:28px 30px 20px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 8px;">
                  <tr>
                    <td align="center" valign="middle" style="padding-right:10px;">
                      <img src="${logoUrl}" width="42" height="42" alt="${provider.name}" style="display:block; width:42px; height:42px; object-fit:contain;" />
                    </td>
                    <td align="left" valign="middle">
                      <div class="force-ink" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:22px; font-weight:900; color:${ink}; letter-spacing:-0.6px; line-height:1.1;">
                        Meter<span style="color:${brandBlue};">Bondhu</span>
                      </div>
                      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:9.5px; font-weight:700; letter-spacing:2.5px; color:${muted}; text-transform:uppercase; margin-top:2px;">
                        ${provider.name} Daily Report
                      </div>
                    </td>
                  </tr>
                </table>

                <!-- Date pill -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:14px auto 0;">
                  <tr>
                    <td align="center" bgcolor="#eff6ff" style="background-color:#eff6ff; border:1px solid #bfdbfe; padding:6px 18px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:11px; font-weight:800; letter-spacing:0.5px; color:${brandBlue}; white-space:nowrap;">
                      📅 ${formattedReportDate}
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <!-- ═══ GREETING ═══ -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td class="content-pad" style="padding:0 30px 8px;">
                <div class="force-ink" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:18px; font-weight:800; color:${ink}; letter-spacing:-0.3px;">
                  Hello, <span style="color:${brandBlue};">${user.full_name}</span>! 👋
                </div>
                <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:13px; color:${muted}; margin-top:6px; line-height:1.6;">
                  Here's your ${provider.name} meter summary for yesterday.
                </div>
              </td></tr>
            </table>

            <!-- ═══ PEAK BANNER (conditional) ═══ -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td class="content-pad" style="padding:14px 30px 0;">
                ${peakBannerHTML}
              </td></tr>
            </table>

            <!-- ═══ YESTERDAY USAGE HERO ═══ -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td class="content-pad" style="padding:8px 30px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background-color:#f8fafc; border:1px solid #e2e8f0;">
                  <tr>
                    <td align="center" style="padding:22px 20px 16px;">
                      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:10.5px; font-weight:800; letter-spacing:2px; color:${muted}; text-transform:uppercase;">
                        Yesterday's Usage
                      </div>
                      <div class="hero-amount" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:38px; font-weight:900; color:${ink}; letter-spacing:-1.5px; line-height:1.05; margin-top:6px;">
                        <span style="font-size:22px; color:${muted}; font-weight:700;">৳</span>${yesterdayUsageTaka.toFixed(2)}
                      </div>
                      ${hasUnit ? `
                        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:13px; font-weight:700; color:${muted}; margin-top:4px;">
                          ${yesterdayUsageUnit.toFixed(2)} kWh
                        </div>
                      ` : `
                        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:11px; font-weight:600; color:#94a3b8; margin-top:4px; font-style:italic;">
                          (Unit not available — ${provider.name} system-B)
                        </div>
                      `}
                    </td>
                  </tr>

                  ${yesterdayRechargeCount > 0 ? `
                  <tr>
                    <td style="padding:0 20px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr><td height="1" bgcolor="#e2e8f0" style="font-size:0; line-height:1px;">&nbsp;</td></tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:14px 20px 20px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                        <tr>
                          <td valign="middle" style="padding-right:8px; font-size:18px; line-height:1;">⚡</td>
                          <td valign="middle" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:13px; color:${muted};">
                            You recharged
                            <strong style="color:#16a34a; font-size:14px;">৳${yesterdayRechargeTaka.toFixed(2)}</strong>
                            yesterday
                            <span style="color:#94a3b8; font-size:11.5px;">(${yesterdayRechargeCount} txn${yesterdayRechargeCount > 1 ? 's' : ''})</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  ` : ''}
                </table>
              </td></tr>
            </table>

            <!-- ═══ CURRENT BALANCE + STATUS ═══ -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td class="content-pad" style="padding:14px 30px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${balanceStatus.bg}" style="background-color:${balanceStatus.bg}; border:1px solid ${balanceStatus.border}; border-radius:12px;">
                  <tr>
                    <td style="padding:16px 20px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="60%" align="left" valign="middle" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                            <div style="font-size:10.5px; font-weight:800; letter-spacing:1.5px; color:${muted}; text-transform:uppercase;">
                              Current Balance
                            </div>
                            <div style="font-size:26px; font-weight:900; color:${balanceStatus.color}; letter-spacing:-1px; line-height:1.15; margin-top:2px;">
                              <span style="font-size:15px; color:${muted}; font-weight:700;">৳</span>${currentBalance.toFixed(2)}
                            </div>
                          </td>
                          <td width="40%" align="right" valign="middle">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-left:auto;">
                              <tr>
                                <td align="center" bgcolor="#ffffff" style="background-color:#ffffff; border:1px solid ${balanceStatus.border}; padding:5px 12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:10px; font-weight:900; letter-spacing:0.8px; color:${balanceStatus.color}; white-space:nowrap;">
                                  ${balanceStatus.icon} ${balanceStatus.label}
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>

                      ${daysLeft !== null && daysLeft >= 0 ? `
                      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12px; color:${muted}; margin-top:10px; line-height:1.5;">
                        At your avg <strong style="color:${ink};">৳${dailyAvgCost.toFixed(0)}/day</strong>, this will last
                        <strong style="color:${balanceStatus.color};">~${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong>.
                        ${balanceThreshold > 0 ? ` Your alert threshold is <strong style="color:${ink};">৳${balanceThreshold.toFixed(0)}</strong>.` : ''}
                      </div>
                      ` : ''}
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <!-- ═══ 7-DAY CHART ═══ -->
            ${chartHTML ? `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td class="content-pad" style="padding:18px 30px 0;">
                ${sectionTitle('📊', 'Last 7 Days Usage')}
                ${boxWrap(chartHTML, { bg: '#f8fafc', border: '#e2e8f0' })}
              </td></tr>
            </table>` : ''}

            <!-- ═══ MONTH SUMMARY ═══ -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td class="content-pad" style="padding:8px 30px 0;">
                ${sectionTitle('📈', 'This Month So Far')}
                ${boxWrap(`
                  ${kvRow('Total Usage', `৳${monthUsageTaka.toFixed(2)}${hasUnit ? ` (${monthUsageUnit.toFixed(1)} kWh)` : ''}`, { bold: true, size: 13.5 })}
                  ${kvRow('Total Recharged', `৳${monthRechargeTaka.toFixed(2)}`, { bold: true, size: 13.5, valueColor: '#16a34a' })}
                  ${kvRow('Avg Daily Usage', `${hasUnit ? `${avgDailyUnit.toFixed(1)} kWh / ` : ''}৳${dailyAvgCost.toFixed(2)}`, { bold: true, size: 13.5, valueColor: '#8b5cf6', topBorder: true })}
                `, { bg: '#f8fafc', border: '#e2e8f0' })}
              </td></tr>
            </table>

            <!-- ═══ SUGGESTION ═══ -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td class="content-pad" style="padding:0 30px;">
                ${suggestionBannerHTML}
              </td></tr>
            </table>

            <!-- ═══ FOOTER ═══ -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td class="content-pad" align="center" style="padding:0 30px 26px;">
                <div style="border-top:1px solid #e2e8f0; padding-top:18px; width:100%;">
                  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12px; color:${muted}; line-height:1.6;">
                    &copy; 2026 MeterBondhu &bull; Powered by <a href="https://www.nexoraq.tech/" style="color:${brandBlue}; text-decoration:none;">Nexoraq Tech</a>
                  </div>
                  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:11px; color:#94a3b8; margin-top:6px;">
  Sent to ${user.email} &bull; Daily report from MeterBondhu
</div>
                  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:10.5px; color:#94a3b8; margin-top:8px; font-style:italic;">
                    You can disable daily reports from Settings.
                  </div>
                </div>
              </td></tr>
            </table>

          </td>
        </tr>
      </table>

    </td>
  </tr>
</table>

</body>
</html>
  `;
}

// ─── Monthly Report Email HTML (RICH + INFORMATIVE) ─────────────────────
getMonthlyReportHTML(user, reportData) {
  const {
    reportMonth = new Date(),
    monthLabel = 'Month',

    // PRIMARY: This month (from monthly_consumption)
    monthUsageTaka = 0,
    monthUsageUnit = 0,

    // SECONDARY: Daily sum (from daily_consumption — transparency)
    dailySumTaka = 0,
    dailySumUnit = 0,
    dailySumFrom = null,
    dailySumTo = null,
    dailySumDays = 0,

    // 3-month trend (from monthly_consumption)
    monthlyTrend = [],

    // This month recharge
    monthRechargeTaka = 0,
    monthRechargeCount = 0,
    rechargeEnergyAmount = 0,
    rechargeChargeAmount = 0,
    rechargeRebate = 0,
    rechargeVat = 0,
    rechargeTotalCharges = 0,

    // Previous month
    prevMonthLabel = 'Previous',
    prevMonthUsageTaka = 0,
    prevMonthUsageUnit = 0,
    prevMonthRechargeTaka = 0,

    // Net
    netAmount = 0,

    // Usage analysis
    avgDailyTaka = 0,
    avgDailyUnit = 0,
    highestDay = null,
    lowestDay = null,
    activeDays = 0,
    totalDays = 30,

    // Balance
    currentBalance = 0,
    balanceThreshold = 0,
    daysOfBuffer = 0,

    // Recharges
    topRecharges = [],

    // 30-day chart
    dailyChart = [],

    // Suggestion
    suggestionData = null,

    // System
    hasUnit = false,
    isSystemB = false,
    meterType = 'desco',
  } = reportData;

  const providerMap = {
    desco: { name: 'DESCO', full: 'Dhaka Electricity Supply Co. PLC' },
    dpdc: { name: 'DPDC', full: 'Dhaka Power Distribution Company' },
    breb: { name: 'BREB', full: 'Bangladesh Rural Electrification Board' },
    bpdb: { name: 'BPDB', full: 'Bangladesh Power Development Board' },
    nesco: { name: 'NESCO', full: 'Northern Electricity Supply Co.' },
    wzpdcl: { name: 'WZPDCL', full: 'West Zone Power Distribution Co.' },
  };
  const provider = providerMap[meterType?.toLowerCase()] || providerMap.desco;

  const LOGO_BASE = 'https://raw.githubusercontent.com/SabbirHossainBorno/Justfun/master';
  const logoMap = {
    desco: `${LOGO_BASE}/DESCO.png`,
    dpdc: `${LOGO_BASE}/DPDC.png`,
    breb: `${LOGO_BASE}/BREB.png`,
    bpdb: `${LOGO_BASE}/BPDB.png`,
    nesco: `${LOGO_BASE}/NESCO.png`,
    wzpdcl: `${LOGO_BASE}/WZPDCL.png`,
  };
  const logoUrl = logoMap[meterType?.toLowerCase()] || logoMap.desco;

  // ─── Month comparison ────────────────────────────────────────────────
  const usageDiff = monthUsageTaka - prevMonthUsageTaka;
  const usagePct = prevMonthUsageTaka > 0 ? (usageDiff / prevMonthUsageTaka) * 100 : 0;
  const isIncreased = usageDiff > 0;
  const diffColor = isIncreased ? '#dc2626' : '#16a34a';
  const diffBg = isIncreased ? '#fef2f2' : '#f0fdf4';
  const diffBorder = isIncreased ? '#fecaca' : '#bbf7d0';
  const diffIcon = isIncreased ? '📈' : '📉';
  const diffLabel = isIncreased ? 'Increased' : 'Decreased';

  // ─── Balance health ──────────────────────────────────────────────────
  const balanceHealth = (() => {
    if (currentBalance <= 0) {
      return { key: 'empty', label: 'EMPTY', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: '🔴' };
    }
    if (daysOfBuffer < 1) {
      return { key: 'critical', label: 'CRITICAL', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: '🔴' };
    }
    if (daysOfBuffer < 3) {
      return { key: 'low', label: 'LOW', color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: '⚠️' };
    }
    if (daysOfBuffer < 7) {
      return { key: 'moderate', label: 'MODERATE', color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: '🟡' };
    }
    return { key: 'healthy', label: 'HEALTHY', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', icon: '✅' };
  })();

  // ─── Palette ─────────────────────────────────────────────────────────
  const ink = '#0f172a';
  const muted = '#64748b';
  const brandBlue = '#2563eb';

  // ─── Helpers ─────────────────────────────────────────────────────────
  const kvRow = (label, value, opts = {}) => {
    const { valueColor = ink, bold = false, topBorder = false, size = 13 } = opts;
    const topStyle = topBorder ? 'border-top:1px solid #e2e8f0; padding-top:10px; margin-top:2px;' : '';
    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
        <tr>
          <td width="58%" align="left" style="padding:${topBorder ? '10px' : '4px'} 0 4px; ${topStyle} font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:${size}px; color:${muted}; font-weight:${bold ? '600' : '400'};">${label}</td>
          <td width="42%" align="right" style="padding:${topBorder ? '10px' : '4px'} 0 4px; ${topStyle} font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:${size}px; color:${valueColor}; font-weight:${bold ? '700' : '500'};">${value}</td>
        </tr>
      </table>`;
  };

  const boxWrap = (inner, { bg = '#f8fafc', border = '#e2e8f0' } = {}) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${bg}" style="background-color:${bg}; border:1px solid ${border}; margin:14px 0;">
      <tr><td style="padding:18px 20px;">${inner}</td></tr>
    </table>`;

  const sectionTitle = (icon, text, color = '#64748b') => `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:10.5px; font-weight:800; letter-spacing:1.5px; color:${color}; text-transform:uppercase; padding-bottom:10px;">
      ${icon} ${text}
    </div>`;

  // ─── 30-Day mini chart ───────────────────────────────────────────────
  let chartHTML = '';
  if (dailyChart.length > 0) {
    const maxTaka = Math.max(...dailyChart.map((d) => d.taka), 1);
    const bars = dailyChart.map((d) => {
      const pct = (d.taka / maxTaka) * 100;
      const dayNum = new Date(d.date).getDate();
      const barColor = d.isHighest ? '#dc2626' : d.isLowest ? '#16a34a' : '#3b82f6';
      return `
        <td align="center" valign="bottom" style="padding:0 1px; vertical-align:bottom;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
            <tr>
              <td align="center" valign="bottom" style="height:60px; vertical-align:bottom; padding-bottom:2px;">
                <div style="background-color:${barColor}; width:80%; height:${Math.max(pct, 3)}%; min-height:3px; border-radius:2px 2px 0 0; margin:0 auto;"></div>
              </td>
            </tr>
            <tr>
              <td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:7.5px; color:${muted}; padding-top:2px;">
                ${dayNum}
              </td>
            </tr>
          </table>
        </td>`;
    }).join('');

    chartHTML = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; table-layout:fixed;">
        <tr>${bars}</tr>
      </table>`;
  }

  // ─── Recharge list ───────────────────────────────────────────────────
  let rechargeListHTML = '';
  if (topRecharges.length > 0) {
    rechargeListHTML = topRecharges.map((r) => {
      const dateLabel = new Date(r.date).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
      });
      return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid #e2e8f0;">
          <tr>
            <td width="50%" align="left" style="padding:8px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:${muted};">
              📅 ${dateLabel} &bull; ${r.operator || provider.name}
            </td>
            <td width="50%" align="right" style="padding:8px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:13px; color:#16a34a; font-weight:700;">
              + ৳${parseFloat(r.amount).toFixed(2)}
            </td>
          </tr>
        </table>`;
    }).join('');
  } else {
    rechargeListHTML = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:${muted}; text-align:center; padding:12px 0; font-style:italic;">No recharges this month.</div>`;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ✅ Recharge Breakdown (Energy + Charges + Rebate + VAT)
  // ═══════════════════════════════════════════════════════════════════════
  const rechargeBreakdownHTML = monthRechargeCount > 0 ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff; border:1px solid #e2e8f0; margin:0 0 14px;">
      <tr>
        <td style="padding:16px 20px;">
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:10.5px; font-weight:800; letter-spacing:1.5px; color:${muted}; text-transform:uppercase; margin-bottom:12px;">
            💰 Recharge Breakdown
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="58%" align="left" style="padding:5px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:${muted};">
                ⚡ Energy Amount
              </td>
              <td width="42%" align="right" style="padding:5px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:${ink}; font-weight:700;">
                ৳${rechargeEnergyAmount.toFixed(2)}
              </td>
            </tr>
            <tr>
              <td width="58%" align="left" style="padding:5px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:${muted};">
                🧾 Charge Amount
              </td>
              <td width="42%" align="right" style="padding:5px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:${ink}; font-weight:700;">
                ৳${rechargeChargeAmount.toFixed(2)}
              </td>
            </tr>
            <tr>
              <td width="58%" align="left" style="padding:5px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:${muted};">
                🎁 Rebate
              </td>
              <td width="42%" align="right" style="padding:5px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:${rechargeRebate < 0 ? '#16a34a' : ink}; font-weight:700;">
                ${rechargeRebate < 0 ? '-' : ''}৳${Math.abs(rechargeRebate).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td width="58%" align="left" style="padding:5px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:${muted};">
                📋 VAT
              </td>
              <td width="42%" align="right" style="padding:5px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:${ink}; font-weight:700;">
                ৳${rechargeVat.toFixed(2)}
              </td>
            </tr>
            <tr>
              <td width="58%" align="left" style="padding:11px 0 5px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:${muted}; border-top:1px solid #e2e8f0; font-weight:600;">
                📊 Total Charges <span style="font-weight:400; color:#94a3b8;">(Charge + Rebate + VAT)</span>
              </td>
              <td width="42%" align="right" style="padding:11px 0 5px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:13px; color:#d97706; border-top:1px solid #e2e8f0; font-weight:800;">
                ৳${rechargeTotalCharges.toFixed(2)}
              </td>
            </tr>
            <tr>
              <td width="58%" align="left" style="padding:11px 0 5px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:13px; color:${brandBlue}; border-top:1px solid #e2e8f0; font-weight:800;">
                ✅ Total Recharged
              </td>
              <td width="42%" align="right" style="padding:11px 0 5px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:15px; color:#16a34a; border-top:1px solid #e2e8f0; font-weight:900;">
                ৳${monthRechargeTaka.toFixed(2)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>` : '';

  // ─── Suggestion block ────────────────────────────────────────────────
  let suggestionHTML = '';
  if (suggestionData && suggestionData.suggestedAmount > 0) {
    const s = suggestionData;
    const inner = `
      ${sectionTitle('💡', 'Next Month Recharge Suggestion', brandBlue)}
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:13px; color:${muted}; line-height:1.6; margin-bottom:14px;">
        Based on your last 3 months usage and current balance, here's what we recommend for next month.
      </div>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff; padding:12px; border:1px solid #e2e8f0;">
        <tr><td>
          ${kvRow('📊 Last 3 months avg usage', `৳${s.avg3Months.toFixed(0)}`)}
          ${kvRow('📈 This month actual', `৳${monthUsageTaka.toFixed(0)}`, { valueColor: brandBlue })}
          ${kvRow('🛡️ Safety buffer (10%)', `৳${s.buffer.toFixed(0)}`)}
          ${kvRow('💵 Current balance', `- ৳${currentBalance.toFixed(0)}`, { valueColor: '#16a34a' })}
          ${kvRow('🔋 Already recharged this month', `- ৳${monthRechargeTaka.toFixed(0)}`, { valueColor: '#16a34a' })}
          ${kvRow('💡 Net recharge needed', `৳${s.netNeeded.toFixed(0)}`, { valueColor: '#d97706', bold: true, topBorder: true })}
        </td></tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f0fdf4" style="background-color:#f0fdf4; border:1px solid #bbf7d0; margin-top:14px;">
        <tr>
          <td align="center" style="padding:18px;">
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:11px; font-weight:800; letter-spacing:1.5px; color:#16a34a; text-transform:uppercase; margin-bottom:4px;">
              💰 Suggested Next Month Top-up
            </div>
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:34px; font-weight:900; color:#16a34a; letter-spacing:-1.5px; line-height:1.1;">
              ৳${s.suggestedAmount}
            </div>
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:11.5px; color:${muted}; margin-top:6px; line-height:1.5;">
              This covers ~1 month at your average consumption rate.
            </div>
          </td>
        </tr>
      </table>`;
    suggestionHTML = boxWrap(inner, { bg: '#eff6ff', border: '#bfdbfe' });
  } else if (currentBalance >= balanceThreshold && daysOfBuffer >= 7) {
    const inner = `
      ${sectionTitle('✅', 'You\'re Covered', '#16a34a')}
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:13px; color:${muted}; line-height:1.7;">
        Your current balance of <strong style="color:#16a34a;">৳${currentBalance.toFixed(2)}</strong> is enough for next month. No top-up needed right now.
      </div>`;
    suggestionHTML = boxWrap(inner, { bg: '#f0fdf4', border: '#bbf7d0' });
  }

  // ─── Insights list ───────────────────────────────────────────────────
  const insights = [];
  if (Math.abs(usagePct) > 5) {
    insights.push({
      icon: diffIcon,
      text: `Your usage <strong>${diffLabel.toLowerCase()}</strong> by <strong style="color:${diffColor};">${Math.abs(usagePct).toFixed(1)}%</strong> compared to ${prevMonthLabel}.`,
    });
  }
  if (highestDay) {
    insights.push({
      icon: '⚡',
      text: `Highest usage was on <strong>${new Date(highestDay.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</strong> — <strong>৳${highestDay.taka.toFixed(2)}</strong>.`,
    });
  }
  if (monthRechargeCount > 0) {
    insights.push({
      icon: '💰',
      text: `You recharged <strong>${monthRechargeCount} time${monthRechargeCount > 1 ? 's' : ''}</strong> this month — total <strong>৳${monthRechargeTaka.toFixed(0)}</strong>.`,
    });
  }
  insights.push({
    icon: '📊',
    text: `Active days: <strong>${activeDays}</strong> out of ${totalDays}. Avg daily: <strong>৳${avgDailyTaka.toFixed(0)}</strong>.`,
  });

  const insightsHTML = insights.map((i) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid #f1f5f9;">
      <tr>
        <td width="26" valign="top" style="padding:10px 8px 10px 0; font-size:14px; line-height:1.2;">${i.icon}</td>
        <td valign="top" style="padding:10px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:${muted}; line-height:1.6;">
          ${i.text}
        </td>
      </tr>
    </table>`).join('');

  // ═══════════════════════════════════════════════════════════════════════
  // Secondary — Daily Sum Transparency Box (English note)
  // ═══════════════════════════════════════════════════════════════════════
  const hasDailySum = dailySumTaka > 0 || dailySumDays > 0;
  const dailySumHTML = hasDailySum ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background-color:#f8fafc; border:1px solid #e2e8f0; margin:14px 0;">
      <tr>
        <td style="padding:16px 20px;">
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:10.5px; font-weight:800; letter-spacing:1.5px; color:${muted}; text-transform:uppercase; margin-bottom:10px;">
            📊 Calculated from Daily Consumption
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="58%" align="left" style="padding:4px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:${muted};">
                Energy (excl. charges/VAT)
              </td>
              <td width="42%" align="right" style="padding:4px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:${ink}; font-weight:700;">
                ৳${dailySumTaka.toFixed(2)}
              </td>
            </tr>
            ${dailySumUnit > 0 ? `
            <tr>
              <td width="58%" align="left" style="padding:4px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:${muted};">
                Consumption
              </td>
              <td width="42%" align="right" style="padding:4px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:${ink}; font-weight:700;">
                ${dailySumUnit.toFixed(2)} kWh
              </td>
            </tr>` : ''}
            ${dailySumFrom && dailySumTo ? `
            <tr>
              <td width="58%" align="left" style="padding:4px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:${muted};">
                Period
              </td>
              <td width="42%" align="right" style="padding:4px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:${ink}; font-weight:700;">
                ${dailySumFrom} — ${dailySumTo}
              </td>
            </tr>
            <tr>
              <td width="58%" align="left" style="padding:4px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:${muted};">
                Total Days
              </td>
              <td width="42%" align="right" style="padding:4px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:${ink}; font-weight:700;">
                ${dailySumDays} days
              </td>
            </tr>` : ''}
          </table>
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:10.5px; color:#94a3b8; font-style:italic; margin-top:10px; line-height:1.5; padding-top:10px; border-top:1px solid #e2e8f0;">
            ⚠️ Note: Full month data for ${monthLabel} has not yet been published by ${provider.name}. This sum only covers ${dailySumDays} day${dailySumDays !== 1 ? 's' : ''} of data.
          </div>
        </td>
      </tr>
    </table>` : '';

  // ═══════════════════════════════════════════════════════════════════════
  // 3-Month Trend Table
  // ═══════════════════════════════════════════════════════════════════════
  const trendRowsHTML = monthlyTrend.length > 0
    ? monthlyTrend.map((m, idx) => {
        const monthName = new Date(m.month + '-01').toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        });
        const isLast = idx === monthlyTrend.length - 1;
        return `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${isLast ? '' : 'border-bottom:1px solid #e2e8f0;'}">
            <tr>
              <td width="40%" align="left" style="padding:10px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:${ink}; font-weight:700;">
                ${monthName}
              </td>
              <td width="30%" align="right" style="padding:10px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:${ink}; font-weight:700;">
                ৳${m.taka.toFixed(2)}
              </td>
              <td width="30%" align="right" style="padding:10px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:11.5px; color:${muted};">
                ${m.unit > 0 ? m.unit.toFixed(1) + ' kWh' : '—'}
              </td>
            </tr>
          </table>`;
      }).join('')
    : `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12.5px; color:${muted}; text-align:center; padding:12px 0; font-style:italic;">No trend data available.</div>`;

  const trendHTML = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="content-pad" style="padding:14px 30px 0;">
        ${sectionTitle('📈', 'Last 3 Months Trend')}
        ${boxWrap(trendRowsHTML, { bg: '#f8fafc', border: '#e2e8f0' })}
      </td></tr>
    </table>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${monthLabel} Report — MeterBondhu</title>
<style>
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
  img { -ms-interpolation-mode: bicubic; border: 0; }
  body { margin: 0; padding: 0; width: 100% !important; background-color: #f1f5f9; }
  :root { color-scheme: light; supported-color-schemes: light; }
  [data-ogsc] .force-ink { color: #0f172a !important; }
  [data-ogsc] .force-card { background-color: #ffffff !important; }
  @media only screen and (max-width: 520px) {
    .email-wrap { width: 100% !important; }
    .content-pad { padding-left: 18px !important; padding-right: 18px !important; }
    .hero-amount { font-size: 32px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f1f5f9">
  <tr>
    <td align="center" style="padding:28px 12px;">

      <table role="presentation" class="email-wrap" width="620" cellpadding="0" cellspacing="0" border="0" style="width:620px; max-width:620px;">
        <tr>
          <td bgcolor="#ffffff" class="force-card" style="background-color:#ffffff; border:1px solid #e2e8f0; overflow:hidden;">

            <!-- TOP ACCENT -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td height="5" bgcolor="${brandBlue}" style="background-color:${brandBlue}; font-size:0; line-height:5px;">&nbsp;</td></tr>
            </table>

            <!-- HEADER -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td class="content-pad" align="center" style="padding:28px 30px 20px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 8px;">
                  <tr>
                    <td align="center" valign="middle" style="padding-right:10px;">
                      <img src="${logoUrl}" width="42" height="42" alt="${provider.name}" style="display:block; width:42px; height:42px; object-fit:contain;" />
                    </td>
                    <td align="left" valign="middle">
                      <div class="force-ink" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:22px; font-weight:900; color:${ink}; letter-spacing:-0.6px; line-height:1.1;">
                        Meter<span style="color:${brandBlue};">Bondhu</span>
                      </div>
                      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:9.5px; font-weight:700; letter-spacing:2.5px; color:${muted}; text-transform:uppercase; margin-top:2px;">
                        ${provider.name} Monthly Report
                      </div>
                    </td>
                  </tr>
                </table>

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:14px auto 0;">
                  <tr>
                    <td align="center" bgcolor="#eff6ff" style="background-color:#eff6ff; border:1px solid #bfdbfe; padding:6px 18px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12px; font-weight:800; letter-spacing:0.5px; color:${brandBlue}; white-space:nowrap;">
                      📅 ${monthLabel}
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <!-- GREETING -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td class="content-pad" style="padding:0 30px 8px;">
                <div class="force-ink" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:18px; font-weight:800; color:${ink}; letter-spacing:-0.3px;">
                  Hello, <span style="color:${brandBlue};">${user.full_name}</span>! 👋
                </div>
                <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:13px; color:${muted}; margin-top:6px; line-height:1.6;">
                  Your complete ${monthLabel} summary is here. See how you used energy and what to plan for next month.
                </div>
              </td></tr>
            </table>

            <!-- HERO: MONTH SUMMARY (PRIMARY from monthly_consumption) -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td class="content-pad" style="padding:14px 30px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background-color:#f8fafc; border:1px solid #e2e8f0;">
                  <tr>
                    <td style="padding:22px 20px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="50%" align="center" style="padding:0 8px; border-right:1px solid #e2e8f0;">
                            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:10px; font-weight:800; letter-spacing:1.5px; color:${muted}; text-transform:uppercase;">
                              💡 Total Usage
                            </div>
                            <div class="hero-amount" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:28px; font-weight:900; color:${ink}; letter-spacing:-1px; line-height:1.1; margin-top:6px;">
                              ৳${monthUsageTaka.toFixed(2)}
                            </div>
                            ${hasUnit ? `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12px; color:${muted}; margin-top:2px;">${monthUsageUnit.toFixed(2)} kWh</div>` : ''}
                          </td>
                          <td width="50%" align="center" style="padding:0 8px;">
                            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:10px; font-weight:800; letter-spacing:1.5px; color:${muted}; text-transform:uppercase;">
                              ⚡ Total Recharged
                            </div>
                            <div class="hero-amount" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:28px; font-weight:900; color:#16a34a; letter-spacing:-1px; line-height:1.1; margin-top:6px;">
                              ৳${monthRechargeTaka.toFixed(2)}
                            </div>
                            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12px; color:${muted}; margin-top:2px;">
                              ${monthRechargeCount} txn${monthRechargeCount !== 1 ? 's' : ''}
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <!-- SECONDARY: DAILY SUM TRANSPARENCY -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td class="content-pad" style="padding:0 30px;">
                ${dailySumHTML}
              </td></tr>
            </table>

            <!-- COMPARISON WITH PREVIOUS MONTH -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td class="content-pad" style="padding:14px 30px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${diffBg}" style="background-color:${diffBg}; border:1px solid ${diffBorder}; border-radius:12px;">
                  <tr>
                    <td style="padding:18px 20px;">
                      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:10.5px; font-weight:800; letter-spacing:1.5px; color:${diffColor}; text-transform:uppercase; margin-bottom:10px;">
                        ${diffIcon} Compared to ${prevMonthLabel}
                      </div>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="70%" valign="middle">
                            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:13px; color:${muted}; line-height:1.6;">
                              Usage <strong style="color:${diffColor};">${diffLabel.toLowerCase()}</strong> by
                              <strong style="color:${diffColor}; font-size:15px;">${Math.abs(usagePct).toFixed(1)}%</strong>
                              (${isIncreased ? '+' : '-'}৳${Math.abs(usageDiff).toFixed(2)})
                            </div>
                          </td>
                          <td width="30%" align="right" valign="middle">
                            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:11px; color:${muted}; text-align:right;">
                              ${prevMonthLabel}<br>
                              <strong style="color:${ink}; font-size:13px;">৳${prevMonthUsageTaka.toFixed(2)}</strong>
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <!-- 3-MONTH TREND -->
            ${trendHTML}

            <!-- USAGE ANALYSIS -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td class="content-pad" style="padding:18px 30px 0;">
                ${sectionTitle('📈', 'Usage Analysis')}
                ${boxWrap(`
                  ${kvRow('📊 Avg Daily Usage', `${hasUnit ? `${avgDailyUnit.toFixed(1)} kWh / ` : ''}৳${avgDailyTaka.toFixed(2)}`, { bold: true })}
                  ${kvRow('⚡ Highest Day', highestDay ? `৳${highestDay.taka.toFixed(2)} (${new Date(highestDay.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })})` : '—', { valueColor: '#dc2626', bold: true })}
                  ${kvRow('🌱 Lowest Day', lowestDay ? `৳${lowestDay.taka.toFixed(2)} (${new Date(lowestDay.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })})` : '—', { valueColor: '#16a34a', bold: true })}
                  ${kvRow('✅ Active Days', `${activeDays} / ${totalDays}`, { bold: true })}
                `, { bg: '#f8fafc', border: '#e2e8f0' })}
              </td></tr>
            </table>

            <!-- BALANCE HEALTH -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td class="content-pad" style="padding:0 30px;">
                ${sectionTitle('💵', 'Balance Health')}
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${balanceHealth.bg}" style="background-color:${balanceHealth.bg}; border:1px solid ${balanceHealth.border}; margin:0 0 14px;">
                  <tr>
                    <td style="padding:16px 20px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="60%" align="left" valign="middle">
                            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:10.5px; font-weight:800; letter-spacing:1.5px; color:${muted}; text-transform:uppercase;">
                              Current Balance
                            </div>
                            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:26px; font-weight:900; color:${balanceHealth.color}; letter-spacing:-1px; line-height:1.15; margin-top:2px;">
                              <span style="font-size:15px; color:${muted}; font-weight:700;">৳</span>${currentBalance.toFixed(2)}
                            </div>
                          </td>
                          <td width="40%" align="right" valign="middle">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-left:auto;">
                              <tr>
                                <td align="center" bgcolor="#ffffff" style="background-color:#ffffff; border:1px solid ${balanceHealth.border}; padding:5px 12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:10px; font-weight:900; letter-spacing:0.8px; color:${balanceHealth.color}; white-space:nowrap;">
                                  ${balanceHealth.icon} ${balanceHealth.label}
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12px; color:${muted}; margin-top:10px; line-height:1.5;">
                        Covers approximately <strong style="color:${balanceHealth.color};">~${daysOfBuffer} day${daysOfBuffer === 1 ? '' : 's'}</strong> at your avg ৳${avgDailyTaka.toFixed(0)}/day.
                        ${balanceThreshold > 0 ? ` Threshold: <strong>৳${balanceThreshold.toFixed(0)}</strong>.` : ''}
                      </div>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <!-- RECHARGE ACTIVITY (with Breakdown) -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td class="content-pad" style="padding:0 30px;">
                ${sectionTitle('💰', `Recharge Activity (${monthRechargeCount} txn${monthRechargeCount !== 1 ? 's' : ''})`)}
                ${rechargeBreakdownHTML}
                ${boxWrap(rechargeListHTML, { bg: '#f8fafc', border: '#e2e8f0' })}
              </td></tr>
            </table>

            <!-- 30-DAY CHART -->
            ${chartHTML ? `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td class="content-pad" style="padding:8px 30px 0;">
                ${sectionTitle('📊', 'Daily Usage Pattern')}
                ${boxWrap(chartHTML, { bg: '#f8fafc', border: '#e2e8f0' })}
                <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:10px; color:${muted}; text-align:center; margin-top:8px;">
                  <span style="color:#dc2626;">●</span> Highest &nbsp;
                  <span style="color:#16a34a;">●</span> Lowest &nbsp;
                  <span style="color:#3b82f6;">●</span> Normal
                </div>
              </td></tr>
            </table>` : ''}

            <!-- SUGGESTION -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td class="content-pad" style="padding:0 30px;">
                ${suggestionHTML}
              </td></tr>
            </table>

            <!-- INSIGHTS -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td class="content-pad" style="padding:14px 30px 0;">
                ${sectionTitle('💡', 'Insights & Tips')}
                ${boxWrap(insightsHTML, { bg: '#fffbeb', border: '#fde68a' })}
              </td></tr>
            </table>

            <!-- FOOTER -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td class="content-pad" align="center" style="padding:22px 30px 26px;">
                <div style="border-top:1px solid #e2e8f0; padding-top:18px; width:100%;">
                  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12px; color:${muted}; line-height:1.6;">
                    &copy; 2026 MeterBondhu &bull; Powered by <a href="https://www.nexoraq.tech/" style="color:${brandBlue}; text-decoration:none;">Nexoraq Tech</a>
                  </div>
                  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:11px; color:#94a3b8; margin-top:6px;">
                    Sent to ${user.email} &bull; Monthly report from MeterBondhu
                  </div>
                  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:10.5px; color:#94a3b8; margin-top:8px; font-style:italic;">
                    You can disable monthly reports from Settings.
                  </div>
                </div>
              </td></tr>
            </table>

          </td>
        </tr>
      </table>

    </td>
  </tr>
</table>

</body>
</html>
  `;
}
}

module.exports = new EmailService();