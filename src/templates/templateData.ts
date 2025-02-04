// src/templates/templateData.ts

// Template summaries provided by the user
export const TEMPLATE_SUMMARIES: { [key: string]: string } = {
  ai_interview_assistant:
    'To guide users through a proficiency interview assessing multiple dimensions of their skills, including technical expertise, psychological traits, and job-specific abilities.',
  virtual_business_analyst:
    'To help users refine and optimize user stories, manage project tasks, and streamline workflows.',
  cloud_computing_interviewer:
    'To conduct an interview assessing the user\'s expertise in cloud computing technologies, architectures, and best practices.',
  sales_interviewer:
    'To evaluate the user\'s sales techniques, customer engagement strategies, and closing abilities through a sales interview.',
  business_executive_advisor:
    'To provide strategic insights, decision-making frameworks, and leadership development tailored to the user\'s business context.',
  entrepreneur_coach:
    'To guide entrepreneurs through building and scaling their businesses, offering actionable insights, resources, and support.',
  investor_pitch_advisor:
    'To help users refine their pitches to potential investors, ensuring they are clear, concise, and persuasive.',
  hr_interviewer:
    'To simulate an HR interview to help users prepare for job interviews across various sectors.',
  technical_support_specialist:
    'To assist users with technical issues related to software, hardware, or network problems.',
  it_consultant:
    'To provide advice on IT infrastructure, cybersecurity, cloud services, and best practices for business or personal needs.',
  software_engineering_peer:
    'To discuss code, review projects, and exchange ideas on software development.',
  ai_specialist:
    'To provide AI consultation sessions, diving into machine learning workflows, AI model implementation, data science strategies, and integration of AI into business solutions.',
  virtual_call_center_operator:
    'To assist with a wide range of customer service issues across various industries.',
};

// Create a unified array of template data
export const templatesList = [
  {
    key: 'ai_interview_assistant',
    displayName: 'AI Interview Assistant (default)',
    summary: TEMPLATE_SUMMARIES['ai_interview_assistant'],
  },
  {
    key: 'virtual_business_analyst',
    displayName: 'Virtual Business Analyst',
    summary: TEMPLATE_SUMMARIES['virtual_business_analyst'],
  },
  {
    key: 'cloud_computing_interviewer',
    displayName: 'Cloud Computing Interviewer',
    summary: TEMPLATE_SUMMARIES['cloud_computing_interviewer'],
  },
  {
    key: 'sales_interviewer',
    displayName: 'Sales Interviewer',
    summary: TEMPLATE_SUMMARIES['sales_interviewer'],
  },
  {
    key: 'business_executive_advisor',
    displayName: 'Business Executive Advisor',
    summary: TEMPLATE_SUMMARIES['business_executive_advisor'],
  },
  {
    key: 'entrepreneur_coach',
    displayName: 'Entrepreneur Coach',
    summary: TEMPLATE_SUMMARIES['entrepreneur_coach'],
  },
  {
    key: 'investor_pitch_advisor',
    displayName: 'Investor Pitch Advisor',
    summary: TEMPLATE_SUMMARIES['investor_pitch_advisor'],
  },
  {
    key: 'hr_interviewer',
    displayName: 'HR Interviewer',
    summary: TEMPLATE_SUMMARIES['hr_interviewer'],
  },
  {
    key: 'technical_support_specialist',
    displayName: 'Technical Support Specialist',
    summary: TEMPLATE_SUMMARIES['technical_support_specialist'],
  },
  {
    key: 'it_consultant',
    displayName: 'IT Consultant',
    summary: TEMPLATE_SUMMARIES['it_consultant'],
  },
  {
    key: 'software_engineering_peer',
    displayName: 'Software Engineering Peer',
    summary: TEMPLATE_SUMMARIES['software_engineering_peer'],
  },
  {
    key: 'ai_specialist',
    displayName: 'AI Specialist',
    summary: TEMPLATE_SUMMARIES['ai_specialist'],
  },
  {
    key: 'virtual_call_center_operator',
    displayName: 'Virtual Call Center Operator',
    summary: TEMPLATE_SUMMARIES['virtual_call_center_operator'],
  },
];
