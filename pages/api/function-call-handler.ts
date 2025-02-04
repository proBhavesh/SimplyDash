// pages/api/function-call-handler.ts

import { NextApiRequest, NextApiResponse } from 'next';

interface JiraContent {
  type: string;
  content?: Array<{
    type: string;
    text?: string;
  }>;
  text?: string;
}

interface MakeWebhookPayload {
  route: string;
  type?: string;
  data1: string;
  data2: string;
  data3: string;
  data4: string;
  data5: string;
  data6: string;
}

function extractTextFromContent(content: Array<{ type: string; text?: string }>): string {
  return content
    .map(item => {
      if (item.type === 'text' && item.text) {
        return item.text;
      } else if (item.type === 'hardBreak') {
        return '\n';
      }
      return '';
    })
    .join('');
}

function parseJiraResponse(responseText: string): { userStory: string; acceptanceCriteria: string[] } {
  try {
    const content = JSON.parse(responseText);
    let userStory = '';
    const acceptanceCriteria: string[] = [];
    let isAcceptanceCriteria = false;

    content.forEach((item: any) => {
      if (item.type === 'paragraph' && Array.isArray(item.content)) {
        const text = extractTextFromContent(item.content);
        
        if (text.includes('Acceptance Criteria:')) {
          isAcceptanceCriteria = true;
          // Split by newlines and filter out empty lines and the "Acceptance Criteria:" header
          const criteria = text.split('\n')
            .filter(line => line.trim() && !line.includes('Acceptance Criteria:'))
            .map(line => line.trim());
          acceptanceCriteria.push(...criteria);
        } else if (!isAcceptanceCriteria) {
          userStory = text.trim();
        }
      }
    });

    return {
      userStory,
      acceptanceCriteria
    };
  } catch (error) {
    console.error('Error parsing Jira response:', error);
    throw error;
  }
}

function formatJiraContent(userStory: string, acceptanceCriteria: string[], showAcceptanceCriteria = false): string {
  let formattedContent = `User Story:\n${userStory}`;
  
  if (showAcceptanceCriteria && acceptanceCriteria.length > 0) {
    formattedContent += '\n\nAcceptance Criteria:\n' + 
      acceptanceCriteria.map((criteria, index) => `${index + 1}. ${criteria}`).join('\n');
  } else if (acceptanceCriteria.length > 0) {
    formattedContent += '\n\nThis issue has acceptance criteria. You can:\n' +
      '1. View the acceptance criteria\n' +
      '2. Update the user story description\n' +
      '3. Update the acceptance criteria\n' +
      '4. Get recommendations for improving the user story\n\n' +
      'What would you like to do?';
  }

  return formattedContent;
}

function combineJiraContent(userStory: string, acceptanceCriteria: string[]): string {
  let combined = userStory.trim();
  
  if (acceptanceCriteria.length > 0) {
    combined += '\n\nAcceptance Criteria:\n' + 
      acceptanceCriteria.map((criteria, index) => `${index + 1}. ${criteria}`).join('\n');
  }
  
  return combined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('Function call handler received request:', {
    method: req.method,
    headers: req.headers,
    body: req.body,
  });

  const { functionName, arguments: args, threadId } = req.body;

  // Map function names to routes in Make.com
  const functionRoutes: { [key: string]: string } = {
    'question_and_answer': '3',
    'book_tow': '4',
    'jira_fetch_issues': '5',
    'jira_get_issue_details': '6',
    'jira_update_issue': '7',
  };

  console.log('Processing function call:', {
    functionName,
    arguments: args,
    threadId,
    availableRoutes: Object.keys(functionRoutes),
  });

  const route = functionRoutes[functionName];

  if (!route) {
    console.error('Unknown function called:', {
      functionName,
      availableRoutes: Object.keys(functionRoutes),
    });
    return res.status(400).json({ error: `Unknown function called: ${functionName}` });
  }

  try {
    // Initialize payload with extended data fields
    const payload: MakeWebhookPayload = {
      route: route,
      data1: '',
      data2: '',
      data3: '',
      data4: '',
      data5: '',
      data6: '',
    };

    if (functionName === 'question_and_answer') {
      payload.data1 = args.question || '';
      payload.data2 = threadId || '';
      console.log('Prepared payload for question_and_answer:', payload);
    } else if (functionName === 'book_tow') {
      payload.data1 = args.address || '';
      console.log('Prepared payload for book_tow:', payload);
    } else if (functionName === 'jira_fetch_issues') {
      // Extract and validate priority
      const priority = args.priority;
      if (!priority || !priority.match(/^P[0-9]$/)) {
        console.error('Invalid priority format:', priority);
        return res.status(200).json({
          result: JSON.stringify({
            message: "I couldn't understand the priority level. Please specify a priority (e.g., P0, P1, P2, P3)."
          })
        });
      }

      // Construct the JQL query
      const jql = `project = "QWER" AND status = "Open" AND priority = "${priority}"`;
      
      // Prepare payload with priority and JQL
      payload.data1 = priority;  // Priority for Make.com
      payload.data2 = jql;       // JQL query
      payload.type = 'jira_search';

      console.log('Preparing to fetch Jira issues:', {
        priority,
        jql,
        payload,
        timestamp: new Date().toISOString(),
      });
    } else if (functionName === 'jira_get_issue_details') {
      // Extract and validate issue key
      const issueKey = args.issueKey;
      if (!issueKey || !issueKey.match(/^[A-Z]+-\d+$/)) {
        console.error('Invalid issue key format:', issueKey);
        return res.status(200).json({
          result: JSON.stringify({
            message: "I couldn't understand the issue key. Please provide it in the format 'QWER-1234'."
          })
        });
      }

      // Prepare payload for issue details request
      payload.data1 = issueKey;
      payload.type = 'jira_get_issue';

      console.log('Preparing to fetch Jira issue details:', {
        issueKey,
        payload,
        timestamp: new Date().toISOString(),
      });
    } else if (functionName === 'jira_update_issue') {
      // Extract and validate issue key
      const issueKey = args.issueKey;
      if (!issueKey || !issueKey.match(/^[A-Z]+-\d+$/)) {
        console.error('Invalid issue key format:', issueKey);
        return res.status(200).json({
          result: JSON.stringify({
            message: "I couldn't understand the issue key. Please provide it in the format 'QWER-1234'."
          })
        });
      }

      // First, get the current issue details to preserve acceptance criteria
      const getDetailsPayload = {
        route: '6', // jira_get_issue_details route
        type: 'jira_get_issue',
        data1: issueKey,
        data2: '',
        data3: '',
        data4: '',
        data5: '',
        data6: '',
      };

      console.log('Fetching current issue details:', {
        issueKey,
        payload: getDetailsPayload,
        timestamp: new Date().toISOString(),
      });

      const detailsResponse = await fetch(process.env.NEXT_PUBLIC_MAKE_WEBHOOK_URL!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(getDetailsPayload),
      });

      if (!detailsResponse.ok) {
        console.error('Failed to fetch current issue details:', detailsResponse.statusText);
        return res.status(500).json({ error: 'Failed to fetch current issue details' });
      }

      const detailsText = await detailsResponse.text();
      console.log('Current issue details:', {
        detailsText,
        timestamp: new Date().toISOString(),
      });

      const { userStory: currentUserStory, acceptanceCriteria: currentAcceptanceCriteria } = parseJiraResponse(detailsText);

      // Validate priority if provided
      if (args.priority && !args.priority.match(/^P[0-9]$/)) {
        console.error('Invalid priority format:', args.priority);
        return res.status(200).json({
          result: JSON.stringify({
            message: "Invalid priority format. Please specify a priority between P0 and P9."
          })
        });
      }

      // Validate due date if provided
      if (args.dueDate && !args.dueDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        console.error('Invalid due date format:', args.dueDate);
        return res.status(200).json({
          result: JSON.stringify({
            message: "Invalid due date format. Please use YYYY-MM-DD format."
          })
        });
      }

      // Prepare payload for issue update
      payload.type = 'jira_update';
      payload.data1 = issueKey;

      // If updating description, combine with existing acceptance criteria
      if (args.description) {
        payload.data2 = combineJiraContent(args.description, currentAcceptanceCriteria);
      } else if (args.acceptanceCriteria) {
        // If updating acceptance criteria, combine with existing user story
        payload.data2 = combineJiraContent(currentUserStory, args.acceptanceCriteria);
      } else {
        // If not updating description or acceptance criteria, preserve current content
        payload.data2 = combineJiraContent(currentUserStory, currentAcceptanceCriteria);
      }

      payload.data3 = args.summary || '';
      payload.data4 = args.dueDate || '';
      payload.data5 = args.priority || '';

      console.log('Preparing to update Jira issue:', {
        issueKey,
        payload,
        timestamp: new Date().toISOString(),
      });
    }

    // Log webhook URL status
    if (!process.env.NEXT_PUBLIC_MAKE_WEBHOOK_URL) {
      console.error('Missing Make.com webhook URL in environment variables', {
        availableEnvVars: Object.keys(process.env),
        timestamp: new Date().toISOString(),
      });
      return res.status(500).json({ error: 'Webhook URL not configured' });
    }

    console.log('Sending request to Make.com webhook:', {
      url: process.env.NEXT_PUBLIC_MAKE_WEBHOOK_URL,
      method: 'POST',
      payload,
      timestamp: new Date().toISOString(),
    });

    const response = await fetch(process.env.NEXT_PUBLIC_MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('Received response from Make.com:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      timestamp: new Date().toISOString(),
    });

    if (!response.ok) {
      console.error('Make.com webhook request failed:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        timestamp: new Date().toISOString(),
      });
      return res.status(500).json({ error: 'Webhook request failed' });
    }

    const responseText = await response.text();
    console.log('Make.com webhook raw response:', {
      responseText,
      timestamp: new Date().toISOString(),
    });

    // Handle different function responses
    if (functionName === 'jira_fetch_issues') {
      try {
        // Check if response is empty
        if (!responseText || responseText.trim() === '') {
          return res.status(200).json({
            result: JSON.stringify({
              message: `I've checked the system and there are currently no ${args.priority} priority issues.`
            })
          });
        }

        // Split the response by tab character and clean up
        const issueTexts = responseText.split('\t').map(text => text.trim()).filter(Boolean);
        console.log('Split issue texts:', {
          issueTexts,
          count: issueTexts.length,
          timestamp: new Date().toISOString(),
        });

        // Parse each issue text
        const issues = issueTexts.map(issueText => {
          const keyMatch = issueText.match(/^([A-Z]+-\d+)(.*)/);
          if (keyMatch) {
            return {
              key: keyMatch[1],
              summary: keyMatch[2].trim()
            };
          }
          return { key: 'Unknown', summary: issueText.trim() };
        });

        console.log('Parsed Jira issues:', {
          issues,
          count: issues.length,
          timestamp: new Date().toISOString(),
        });

        if (issues.length === 0) {
          return res.status(200).json({
            result: JSON.stringify({
              message: `I've checked the system and there are currently no ${args.priority} priority issues.`
            })
          });
        }

        // Format the issues into a readable message
        const formattedIssues = issues
          .map(issue => `${issue.key}: ${issue.summary}`)
          .join('\n- ');

        const response = {
          result: JSON.stringify({
            message: `Here are the current ${args.priority} priority issues:\n- ${formattedIssues}\n\nYou can ask me for more details about any specific issue by mentioning its key (e.g., "Tell me more about QWER-1234").`
          })
        };

        console.log('Sending formatted response:', {
          response,
          issueCount: issues.length,
          timestamp: new Date().toISOString(),
        });

        return res.status(200).json(response);
      } catch (error) {
        console.error('Error processing Jira response:', {
          error,
          responseText,
          timestamp: new Date().toISOString(),
        });

        return res.status(200).json({
          result: JSON.stringify({
            message: "I encountered an error while processing the issues data. Please try again or contact support if the issue persists."
          })
        });
      }
    } else if (functionName === 'jira_get_issue_details') {
      try {
        // Parse and extract the user story and acceptance criteria
        const { userStory, acceptanceCriteria } = parseJiraResponse(responseText);
        
        // Format the content based on whether to show acceptance criteria
        const formattedContent = formatJiraContent(
          userStory,
          acceptanceCriteria,
          args.showAcceptanceCriteria === true
        );

        // Format the response with issue details
        const formattedResponse = {
          result: JSON.stringify({
            message: `Here are the details for ${args.issueKey}:\n\n${formattedContent}`,
            rawContent: JSON.parse(responseText)  // Include the original structured content
          })
        };

        console.log('Sending formatted issue details:', {
          response: formattedResponse,
          timestamp: new Date().toISOString(),
        });

        return res.status(200).json(formattedResponse);
      } catch (error) {
        console.error('Error processing issue details:', {
          error,
          responseText,
          timestamp: new Date().toISOString(),
        });

        return res.status(200).json({
          result: JSON.stringify({
            message: "I encountered an error while retrieving the issue details. Please try again or contact support if the issue persists."
          })
        });
      }
    } else if (functionName === 'jira_update_issue') {
      try {
        // Check if the update was successful
        if (response.ok) {
          // Format success message based on what was updated
          const updatedFields = [];
          if (args.description) updatedFields.push('description');
          if (args.acceptanceCriteria) updatedFields.push('acceptance criteria');
          if (args.summary) updatedFields.push('summary');
          if (args.dueDate) updatedFields.push('due date');
          if (args.priority) updatedFields.push('priority');

          const fieldsList = updatedFields.join(', ');
          const message = updatedFields.length > 0
            ? `Successfully updated ${args.issueKey} with new ${fieldsList}.`
            : `Successfully updated ${args.issueKey}.`;

          return res.status(200).json({
            result: JSON.stringify({
              message: `${message} Would you like to see the updated details?`
            })
          });
        } else {
          throw new Error(`Update failed with status: ${response.status}`);
        }
      } catch (error) {
        console.error('Error processing issue update:', {
          error,
          responseText,
          timestamp: new Date().toISOString(),
        });

        return res.status(200).json({
          result: JSON.stringify({
            message: "I encountered an error while updating the issue. Please try again or contact support if the issue persists."
          })
        });
      }
    }
    
    // For other functions, return the response as is
    return res.status(200).json({ result: responseText });
  } catch (error) {
    console.error('Error processing function call:', {
      functionName,
      error,
      timestamp: new Date().toISOString(),
    });

    return res.status(500).json({ error: 'Internal server error' });
  }
}
