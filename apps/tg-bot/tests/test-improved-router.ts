import "dotenv/config";
import OpenAI from "openai";
import { z } from "zod";
import type { Address } from "viem";

// Initialize OpenRouter with sherlock-think-alpha
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: "https://openrouter.ai/api/v1",
});

// Test address
const TEST_ADDRESS = "0x07b780E6D4D7177bd596e7caBf2725a471E685Dc" as Address;

// Helper function
function log(title: string, data: any) {
  console.log(`\n===== ${title} =====`);
  console.log(JSON.stringify(data, null, 2));
}

// Enhanced tool schema with better structure
const ImprovedToolSchema = z.object({
  analysis: z.object({
    intent: z.string().describe("What the user wants to do"),
    entities: z.object({
      tokens: z.array(z.string()).optional(),
      amounts: z.array(z.string()).optional(),
      addresses: z.array(z.string()).optional(),
      limits: z.array(z.number()).optional()
    }).optional(),
    confidence: z.number().min(0).max(1)
  }),
  tool_selection: z.object({
    tool: z.enum([
      "mint", "transfer", "swap",
      "get_balances", "get_transactions", "get_positions", "get_wallet_summary",
      "create_alert", "list_alerts", "remove_alert",
      "no_tool"
    ]),
    reasoning: z.string(),
    alternatives: z.array(z.string()).optional()
  }),
  parameters: z.any().optional(),
  response_guidance: z.object({
    user_message: z.string().optional(),
    next_steps: z.array(z.string()).optional(),
    warnings: z.array(z.string()).optional()
  })
});

// Comprehensive test prompts
const COMPREHENSIVE_PROMPTS = [
  // Simple cases
  {
    prompt: "what's my balance",
    context: "User wants to check token balances"
  },
  {
    prompt: "swap 10 MockUSD for MockToken",
    context: "Clear swap request with all parameters"
  },
  // Complex cases
  {
    prompt: "I have some MockUSD and want to get MockToken instead, maybe around half of what I have",
    context: "Vague swap request needing balance check first"
  },
  {
    prompt: "send all my MockToken except 100 to my friend at 0x1234567890123456789012345678901234567890",
    context: "Transfer with calculation needed"
  },
  // Multi-step cases
  {
    prompt: "check my balance, then swap half of my MockUSD for MockToken, and send the result to 0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
    context: "Multiple operations requested"
  },
  // Edge cases
  {
    prompt: "can you stake my tokens?",
    context: "Unsupported operation"
  },
  {
    prompt: "hello how are you",
    context: "Greeting, no crypto operation"
  },
  {
    prompt: "my transaction failed, what happened?",
    context: "Debugging request"
  }
];

async function testImprovedRouting() {
  log("Testing Improved LLM Routing with Sherlock Think Alpha", {
    model: "openrouter/sherlock-think-alpha",
    description: "Advanced routing with better analysis"
  });

  for (const test of COMPREHENSIVE_PROMPTS) {
    log(`\nProcessing: "${test.prompt}"`, {
      context: test.context
    });

    try {
      const response = await openai.chat.completions.create({
        model: "openrouter/sherlock-think-alpha",
        messages: [
          {
            role: "system",
            content: `You are an advanced transaction router for a crypto bot. Analyze user requests deeply.

Your task:
1. Analyze the user's intent and extract key entities
2. Select the most appropriate tool or indicate no tool available
3. Generate parameters if a tool is selected
4. Provide guidance on how to respond to the user

Available tools:
- mint: Create test tokens (MockUSD or MockToken)
- transfer: Send tokens to another address
- swap: Exchange between MockUSD and MockToken
- get_balances: Check token balances
- get_transactions: View transaction history
- get_positions: View DeFi positions
- get_wallet_summary: Get total portfolio value
- create_alert, list_alerts, remove_alert: Manage alerts
- no_tool: When no appropriate tool exists

Important considerations:
- User's address: ${TEST_ADDRESS}
- For vague requests, identify what information is needed
- For multi-step requests, identify the sequence
- For unsupported operations, explain limitations
- Consider user experience in your response guidance

Return a structured JSON response.`
          },
          {
            role: "user",
            content: test.prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 1000
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error("No response");

      const parsed = JSON.parse(content);
      const validated = ImprovedToolSchema.parse(parsed);

      log("Analysis Results", {
        intent: validated.analysis.intent,
        confidence: validated.analysis.confidence,
        entities: validated.analysis.entities,
        selectedTool: validated.tool_selection.tool,
        reasoning: validated.tool_selection.reasoning
      });

      if (validated.parameters) {
        log("Generated Parameters", validated.parameters);
      }

      if (validated.response_guidance.user_message) {
        log("Suggested User Response", {
          message: validated.response_guidance.user_message,
          warnings: validated.response_guidance.warnings,
          nextSteps: validated.response_guidance.next_steps
        });
      }

    } catch (error) {
      log("Error", { message: error.message });
    }

    // Rate limit consideration
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

async function testToolChaining() {
  log("Testing Tool Chaining Scenarios", {
    description: "Testing how to handle requests that need multiple tools"
  });

  const chainScenarios = [
    {
      prompt: "check my balance and then swap all my MockUSD for MockToken",
      expectedChain: ["get_balances", "swap"]
    },
    {
      prompt: "if I have more than 100 MockUSD, swap 50 for MockToken",
      expectedChain: ["get_balances", "conditional:swap"]
    },
    {
      prompt: "show me my portfolio value and recent swaps",
      expectedChain: ["get_wallet_summary", "get_transactions"]
    }
  ];

  for (const scenario of chainScenarios) {
    log(`\nChain Scenario: "${scenario.prompt}"`, {
      expectedChain: scenario.expectedChain
    });

    const response = await openai.chat.completions.create({
      model: "openrouter/sherlock-think-alpha",
      messages: [
        {
          role: "system",
          content: `Analyze requests that may require multiple tool calls. Identify the sequence of operations needed.

For each request:
1. Identify all operations needed
2. Determine the order of operations
3. Identify dependencies between operations
4. Consider conditional logic

Return JSON with:
- operations: Array of operations in order
- dependencies: Which operations depend on others
- conditional_logic: Any conditions that affect execution`
        },
        {
          role: "user",
          content: scenario.prompt
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content!);
    log("Chain Analysis", result);
  }
}

async function testErrorHandling() {
  log("Testing Error Handling and Recovery", {
    description: "Testing how to handle various error scenarios"
  });

  const errorScenarios = [
    {
      prompt: "my swap failed with slippage error",
      errorType: "slippage"
    },
    {
      prompt: "I can't send tokens, it says insufficient balance",
      errorType: "insufficient_funds"
    },
    {
      prompt: "the transaction is stuck pending for 10 minutes",
      errorType: "pending_tx"
    },
    {
      prompt: "I approved the tokens but the swap still fails",
      errorType: "approval_issue"
    }
  ];

  for (const scenario of errorScenarios) {
    log(`\nError Scenario: "${scenario.prompt}"`, {
      errorType: scenario.errorType
    });

    const response = await openai.chat.completions.create({
      model: "openrouter/sherlock-think-alpha",
      messages: [
        {
          role: "system",
          content: `You are helping users debug crypto transaction errors. Analyze the error and provide helpful guidance.

For each error:
1. Identify the type of error
2. Determine likely causes
3. Suggest solutions
4. Recommend preventive measures

Be helpful and educational. Return JSON with:
- error_type: The type of error
- likely_causes: Array of possible causes
- solutions: Array of actionable solutions
- prevention: How to avoid this in future
- follow_up_tool: Which tool might help diagnose/fix`
        },
        {
          role: "user",
          content: scenario.prompt
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content!);
    log("Error Analysis", result);
  }
}

async function runAllTests() {
  console.log("🧠 RISE TG Bot - Improved Router Tests\n");
  
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("❌ OPENROUTER_API_KEY not set");
    return;
  }
  
  await testImprovedRouting();
  await testToolChaining();
  await testErrorHandling();
  
  console.log("\n✅ All improved router tests completed!");
}

// Run tests
runAllTests().catch(console.error);