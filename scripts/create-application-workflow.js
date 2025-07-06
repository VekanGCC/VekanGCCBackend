const mongoose = require('mongoose');
const WorkflowConfiguration = require('../models/WorkflowConfiguration');
const connectDB = require('../config/database');

// Connect to database
connectDB();

const createApplicationWorkflow = async () => {
  try {
    console.log('🔧 Creating Application Workflow Configuration...');

    // Check if workflow already exists
    const existingWorkflow = await WorkflowConfiguration.findOne({ 
      name: 'Application Approval and Selection Workflow' 
    });

    if (existingWorkflow) {
      console.log('⚠️  Workflow already exists. Updating...');
      await WorkflowConfiguration.findByIdAndDelete(existingWorkflow._id);
    }

    const workflowConfig = {
      name: 'Application Approval and Selection Workflow',
      description: 'Complete workflow for application approval and client selection process: Apply → Admin Approval → Shortlisted → Client Process → Offer → Admin Offer Approval',
      isActive: true,
      isDefault: true,
      applicationTypes: ['client_applied', 'vendor_applied', 'both'],
      steps: [
        // Phase 1: Initial Application
        {
          name: 'Application Submitted',
          order: 1,
          role: 'admin',
          action: 'review',
          required: true,
          autoAdvance: true,
          description: 'Client or Vendor submits application for resource or requirement',
          notifications: [{
            type: 'in_app',
            template: 'application_submitted_notification',
            recipients: ['admin']
          }]
        },

        // Phase 2: Admin Approval/Rejection
        {
          name: 'Admin Review',
          order: 2,
          role: 'admin',
          action: 'review',
          required: true,
          autoAdvance: false,
          description: 'Admin reviews the application for platform compliance and quality',
          notifications: [{
            type: 'in_app',
            template: 'application_review_notification',
            recipients: ['admin']
          }]
        },
        {
          name: 'Admin Approval',
          order: 3,
          role: 'admin',
          action: 'approve',
          required: true,
          autoAdvance: false,
          description: 'Admin approves or rejects the application. If approved, status becomes Shortlisted',
          notifications: [{
            type: 'email',
            template: 'admin_approval_notification',
            recipients: ['applicant', 'client', 'vendor']
          }]
        },

        // Phase 3: Client Selection Process (Only if Admin Approved)
        {
          name: 'Client Shortlist',
          order: 4,
          role: 'client',
          action: 'interact',
          required: true,
          autoAdvance: false,
          description: 'Client shortlists the candidate for further consideration',
          notifications: [{
            type: 'email',
            template: 'shortlist_notification',
            recipients: ['applicant', 'vendor']
          }]
        },
        {
          name: 'Interview Process',
          order: 5,
          role: 'client',
          action: 'interact',
          required: true,
          autoAdvance: false,
          description: 'Client conducts interview with the candidate',
          notifications: [{
            type: 'email',
            template: 'interview_notification',
            recipients: ['applicant', 'vendor']
          }]
        },
        {
          name: 'Client Accept',
          order: 6,
          role: 'client',
          action: 'approve',
          required: true,
          autoAdvance: false,
          description: 'Client accepts the candidate after interview',
          notifications: [{
            type: 'email',
            template: 'client_accept_notification',
            recipients: ['applicant', 'vendor']
          }]
        },
        {
          name: 'Create Offer',
          order: 7,
          role: 'client',
          action: 'interact',
          required: true,
          autoAdvance: false,
          description: 'Client creates formal offer for the vendor',
          notifications: [{
            type: 'email',
            template: 'offer_created_notification',
            recipients: ['vendor', 'admin']
          }]
        },

        // Phase 4: Admin Offer Approval
        {
          name: 'Admin Offer Review',
          order: 8,
          role: 'admin',
          action: 'review',
          required: true,
          autoAdvance: false,
          description: 'Admin reviews the offer created by client',
          notifications: [{
            type: 'in_app',
            template: 'offer_review_notification',
            recipients: ['admin']
          }]
        },
        {
          name: 'Admin Offer Approval',
          order: 9,
          role: 'admin',
          action: 'approve',
          required: true,
          autoAdvance: false,
          description: 'Admin accepts or rejects the offer. If accepted, status becomes offer_accepted',
          notifications: [{
            type: 'email',
            template: 'offer_approval_notification',
            recipients: ['client', 'vendor']
          }]
        },

        // Phase 5: Final Process
        {
          name: 'Vendor In Process',
          order: 10,
          role: 'vendor',
          action: 'interact',
          required: true,
          autoAdvance: false,
          description: 'Vendor can see application is in process and can revoke if needed',
          notifications: [{
            type: 'email',
            template: 'vendor_in_process_notification',
            recipients: ['vendor']
          }]
        },
        {
          name: 'SOW Creation',
          order: 11,
          role: 'client',
          action: 'interact',
          required: true,
          autoAdvance: true,
          description: 'Client creates Statement of Work based on the process',
          notifications: [{
            type: 'email',
            template: 'sow_creation_notification',
            recipients: ['vendor']
          }]
        }
      ],
      settings: {
        allowParallelProcessing: false,
        maxProcessingTime: 168, // 7 days
        autoEscalateAfter: 48, // 48 hours
        requireComments: true
      },
      createdBy: new mongoose.Types.ObjectId(),
      updatedBy: new mongoose.Types.ObjectId()  // Will be updated with actual admin user
    };

    const workflow = await WorkflowConfiguration.create(workflowConfig);

    console.log('✅ Application Workflow created successfully!');
    console.log('📋 Workflow Details:');
    console.log(`   ID: ${workflow._id}`);
    console.log(`   Name: ${workflow.name}`);
    console.log(`   Steps: ${workflow.steps.length}`);
    console.log(`   Status: ${workflow.isActive ? 'Active' : 'Inactive'}`);
    console.log(`   Default: ${workflow.isDefault ? 'Yes' : 'No'}`);
    
    console.log('\n📝 Workflow Steps:');
    workflow.steps.forEach((step, index) => {
      console.log(`   ${index + 1}. ${step.name} (${step.role} - ${step.action})`);
    });

    console.log('\n🎯 Access Control Summary:');
    console.log('   • Admin: Can see all statuses, approve/reject applications and offers');
    console.log('   • Client: Can see all statuses, change status (shortlist → interview → accept → create offer)');
    console.log('   • Vendor: Can only see "In Process" status, can revoke at any point');
    console.log('   • Status Flow: Applied → Admin Approval → Shortlisted → Interview → Accepted → Create Offer → Admin Offer Approval → Offer Accepted');

    return workflow;

  } catch (error) {
    console.error('❌ Error creating workflow:', error);
    throw error;
  }
};

// Run the script
if (require.main === module) {
  createApplicationWorkflow()
    .then(() => {
      console.log('\n🎉 Workflow setup completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Workflow setup failed:', error);
      process.exit(1);
    });
}

module.exports = createApplicationWorkflow; 