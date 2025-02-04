import React from 'react';

const Introduction: React.FC = () => {
  return (
    <div className="mb-6">
      <p className="text-lg leading-relaced">
        <span className="font-semibold">Description:</span> The Virtual Analyst helps users refine and optimize user stories, manage
        project tasks, and streamline workflows. Please upload your blueprint
        (create one here if needed:{' '}
        <a
          href="https://www.pega.com/blueprint"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline hover:text-blue-800"
        >
          https://www.pega.com/blueprint
        </a>
        ) and click <strong>-Upload-</strong>. The assistant will read your blueprint, structure
        user stories as Jira sub-tasks, optimize them, and prioritize based on
        importance. This process takes about 25 minutes, after which you will
        receive a notification. You can then review and discuss user stories with
        your assistant. If you have already uploaded a blueprint, connect to the
        assistant to query prioritized user stories, make updates, or ask for
        further optimization.
      </p>
    </div>
  );
};

export default Introduction;
