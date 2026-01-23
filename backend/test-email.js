// Test email sending
import { User } from './src/models/index.js';
import emailService from './src/utils/emailService.js';

async function testEmail() {
  try {
    console.log('📧 Testing email configuration...\n');
    
    // Test connection first
    console.log('🔌 Testing SMTP connection...');
    const connectionTest = await emailService.testConnection({
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      smtpUsername: 'Prabhatchaubey56@gmail.com',
      smtpPassword: 'phoyjlucrtnitrkb'
    });
    
    console.log('Connection result:', connectionTest);
    
    if (!connectionTest.success) {
      console.log('\n❌ SMTP connection failed. Cannot send email.');
      process.exit(1);
    }
    
    console.log('\n✅ SMTP connection successful!\n');
    
    // Send test welcome email
    console.log('📨 Sending test welcome email to prabhatchaubey56@gmail.com...');
    const emailResult = await emailService.sendWelcomeEmail(
      18, // user_id from database
      'prabhatchaubey56@gmail.com',
      'Prabhat'
    );
    
    console.log('\n✉️ Email send result:', JSON.stringify(emailResult, null, 2));
    
    if (emailResult.success) {
      console.log('\n🎉 SUCCESS! Check your email at prabhatchaubey56@gmail.com');
      console.log('📬 Subject: Welcome to UpTrender - Your Trading Journey Begins!');
    } else {
      console.log('\n❌ FAILED:', emailResult.error);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
  
  process.exit(0);
}

testEmail();
