import { config } from "dotenv";
import { resolve } from "path";
import OpenAI from "openai";
import { z } from "zod";
import type { Address } from "viem";

// Load .env from monorepo root
config({ path: resolve(process.cwd(), "../../.env") });

// Test address
const TEST_ADDRESS = "0x07b780E6D4D7177bd596e7caBf2725a471E685Dc" as Address;

// Check for API key
if (!process.env.OPENROUTER_API_KEY) {
  console.log("⚠️  Skipping LLM routing tests - OPENROUTER_API_KEY not set");
  console.log("Make sure .env is in the monorepo root with OPENROUTER_API_KEY");
  process.exit(0);
}

// Initialize OpenRouter with different models
const openaiGPT4 = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: "https://openrouter.ai/api/v1",
});

// Helper function to log results
function log(title: string, data: any) {
  console.log(`\n===== ${title} =====`);
  console.log(JSON.stringify(data, null, 2));
}

// Enhanced tool schema with better descriptions
const EnhancedToolSchema = z.discriminatedUnion("tool", [
  // Transaction tools
  z.object({
    tool: z.literal("mint"),
    params: z.object({
      tokenSymbol: z.enum(["MockUSD", "MockToken"]),
    }),
    reasoning: z.string().optional()
  }),
  z.object({
    tool: z.literal("transfer"),
    params: z.object({
      tokenSymbol: z.enum(["RISE", "MockUSD", "MockToken"]),
      to: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      amount: z.string().regex(/^\d+(\.\d+)?$/),
    }),
    reasoning: z.string().optional()
  }),
  z.object({
    tool: z.literal("swap"),
    params: z.object({
      fromToken: z.enum(["MockUSD", "MockToken"]),
      toToken: z.enum(["MockUSD", "MockToken"]),
      amount: z.string().regex(/^\d+(\.\d+)?$/),
      recipient: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
      slippagePercent: z.number().min(0).max(10).optional(),
    }),
    reasoning: z.string().optional()
  }),
  // Query tools
  z.object({
    tool: z.literal("get_balances"),
    params: z.object({
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    }),
    reasoning: z.string().optional()
  }),
  z.object({
    tool: z.literal("get_transactions"),
    params: z.object({
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      limit: z.number().min(1).max(100).optional(),
    }),
    reasoning: z.string().optional()
  }),
  z.object({
    tool: z.literal("get_wallet_summary"),
    params: z.object({
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    }),
    reasoning: z.string().optional()
  }),
  // No matching tool
  z.object({
    tool: z.literal("no_tool"),
    params: z.object({}),
    reasoning: z.string(),
    suggested_response: z.string()
  })
]);

// Test prompts covering various scenarios
const TEST_PROMPTS = [
  // Simple queries
  {
    prompt: "what's my balance",
    expectedTool: "get_balances"
  },
  {
    prompt: "show me my recent activity",
    expectedTool: "get_transactions"
  },
  {
    prompt: "how much am I worth in total",
    expectedTool: "get_wallet_summary"
  },
  // Transaction prompts
  {
    prompt: "swap 10 MockUSD for MockToken",
    expectedTool: "swap"
  },
  {
    prompt: "send 5.5 MockToken to 0x1234567890123456789012345678901234567890",
    expectedTool: "transfer"
  },
  {
    prompt: "mint some test tokens",
    expectedTool: "mint"
  },
  // Complex prompts
  {
    prompt: "I want to trade all my MockUSD for MockToken with 2% slippage",
    expectedTool: "swap"
  },
  {
    prompt: "transfer half of my MockUSD to my friend at 0x9876543210987654321098765432109876543210",
    expectedTool: "transfer" 
  },
  // Ambiguous prompts
  {
    prompt: "help me with my tokens",
    expectedTool: "get_balances" // Could be multiple
  },
  {
    prompt: "I need MockToken",
    expectedTool: "mint" // Or could be swap
  },
  // Edge cases
  {
    prompt: "stake my tokens",
    expectedTool: "no_tool"
  },
  {
    prompt: "buy NFT",
    expectedTool: "no_tool"
  },
  {
    prompt: "what's the weather",
    expectedTool: "no_tool"
  },
  {
    prompt: "hello",
    expectedTool: "no_tool"
  }
];

async function testLLMRouting(model: string, modelName: string) {
  log(`Testing LLM Routing with ${modelName}`, {
    model,
    userAddress: TEST_ADDRESS
  });

  const results: Array<{
    prompt: string;
    expectedTool: string;
    actualTool?: string;
    correct: boolean;
    reasoning?: string;
    params?: any;
    suggestedResponse?: string;
    error?: string;
  }> = [];

  for (const test of TEST_PROMPTS) {
    try {
      const response = await openaiGPT4.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: `You are a transaction router for the RISE chain Telegram bot. Analyze user prompts and select the appropriate tool.

User's wallet address: ${TEST_ADDRESS}

Available tools:
1. mint: Mint test tokens
   Required params: tokenSymbol (must be exactly "MockUSD" or "MockToken")

2. transfer: Send tokens to another address
   Required params:
   - tokenSymbol: must be exactly "RISE", "MockUSD", or "MockToken"
   - to: recipient address (0x... format)
   - amount: must be a string representing a decimal number (e.g. "10", "5.5", "0.1")

3. swap: Exchange tokens
   Required params:
   - fromToken: must be exactly "MockUSD" or "MockToken"
   - toToken: must be exactly "MockUSD" or "MockToken"
   - amount: must be a string representing a decimal number (e.g. "10", "42.5")
   Optional: slippagePercent (number), recipient (address)

4. get_balances: Check token balances
   Required params: address (use ${TEST_ADDRESS} if not specified)

5. get_transactions: View transaction history
   Required params: address (use ${TEST_ADDRESS} if not specified)
   Optional: limit (number)

6. get_wallet_summary: Get total portfolio value
   Required params: address (use ${TEST_ADDRESS} if not specified)

CRITICAL RULES:
- ALL amount values MUST be strings, never numbers (e.g. "10" not 10, "5.5" not 5.5)
- Token names MUST match exactly: "MockUSD", "MockToken", "RISE"
- If user says vague amounts like "all", "half", "some", return no_tool with explanation
- ALL required params MUST be present - do not skip any
- If unsure about any parameter, use no_tool

Return a JSON object with:
- tool: The selected tool name (or "no_tool")
- params: Object with ALL required parameters (with correct types)
- reasoning: Brief explanation of why you chose this tool
- suggested_response: (only for no_tool) What to tell the user`
          },
          {
            role: "user",
            content: test.prompt
          }
        ],
        response_format: {
          type: "json_object"
        },
        temperature: 0.2, // Lower temperature for more consistent routing
        max_tokens: 500
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("No response content");
      }

      const parsed = JSON.parse(content);
      const validated = EnhancedToolSchema.parse(parsed);
      
      const result = {
        prompt: test.prompt,
        expectedTool: test.expectedTool,
        actualTool: validated.tool,
        correct: validated.tool === test.expectedTool,
        reasoning: validated.reasoning,
        params: validated.params,
        suggestedResponse: validated.tool === "no_tool" ? validated.suggested_response : undefined
      };

      results.push(result);
      
      log(`Prompt: "${test.prompt}"`, {
        expected: test.expectedTool,
        actual: validated.tool,
        correct: result.correct ? "✅" : "❌",
        reasoning: validated.reasoning
      });

      if (validated.tool !== "no_tool") {
        log("Extracted Parameters", validated.params);
      } else {
        log("Suggested Response", validated.suggested_response);
      }

    } catch (error) {
      results.push({
        prompt: test.prompt,
        expectedTool: test.expectedTool,
        error: error instanceof Error ? error.message : String(error),
        correct: false
      });

      log(`❌ Error for prompt: "${test.prompt}"`, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Calculate accuracy
  const correct = results.filter(r => r.correct).length;
  const accuracy = (correct / results.length * 100).toFixed(1);
  
  log(`${modelName} Results Summary`, {
    totalPrompts: results.length,
    correct,
    accuracy: `${accuracy}%`,
    errors: results.filter(r => r.error).length
  });

  return results;
}

async function testComplexPromptParsing() {
  log("Testing Complex Prompt Parsing", {
    description: "Testing extraction of parameters from natural language"
  });

  const complexPrompts = [
    {
      prompt: "can you swap 42.5 MockUSD for MockToken and send it to my friend at 0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
      expected: {
        tool: "swap",
        fromToken: "MockUSD",
        toToken: "MockToken", 
        amount: "42.5",
        recipient: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12"
      }
    },
    {
      prompt: "exchange twenty five and a half mocktoken to mockusd with 3 percent slippage please",
      expected: {
        tool: "swap",
        fromToken: "MockToken",
        toToken: "MockUSD",
        amount: "25.5",
        slippagePercent: 3
      }
    },
    {
      prompt: "I'd like to see my last 15 transactions from yesterday",
      expected: {
        tool: "get_transactions",
        limit: 15
      }
    }
  ];

  for (const test of complexPrompts) {
    try {
      const response = await openaiGPT4.chat.completions.create({
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Extract tool parameters from natural language. Be precise with numbers and addresses.
            
Tools:
- swap: fromToken, toToken, amount (decimal string), recipient (optional), slippagePercent (optional number)
- transfer: tokenSymbol, to (address), amount (decimal string)
- get_transactions: address, limit (optional number)

Parse amounts carefully:
- "twenty five and a half" = "25.5"
- "42.5" = "42.5"
- "3 percent" = 3 (as number)

Return JSON with tool name and params.`
          },
          {
            role: "user", 
            content: test.prompt
          }
        ],
        response_format: {
          type: "json_object"
        }
      });

      const parsed = JSON.parse(response.choices[0].message.content!);

      // Compare only the fields that are in expected
      const actualParams: Record<string, any> = { tool: parsed.tool, ...parsed.params };
      const expectedParams: Record<string, any> = test.expected;
      const matches = Object.keys(expectedParams).every(key => {
        const actual = actualParams[key];
        const expected = expectedParams[key];
        // Case-insensitive comparison for strings
        if (typeof actual === 'string' && typeof expected === 'string') {
          return actual.toLowerCase() === expected.toLowerCase();
        }
        return actual === expected;
      });

      log(`Complex Prompt: "${test.prompt}"`, {
        extracted: parsed,
        expected: test.expected,
        paramsMatch: matches
      });
      
    } catch (error) {
      log("Error parsing complex prompt", {
        prompt: test.prompt,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

async function testModelComparison() {
  log("Comparing Different Models", {
    description: "Testing routing accuracy across different models"
  });

  const models = [
    { id: "openai/gpt-4o-mini", name: "GPT-4o Mini" },
    { id: "anthropic/claude-3-haiku", name: "Claude 3 Haiku" }
  ];

  const allResults: Array<{
    model: string;
    results: Array<{
      prompt: string;
      expectedTool: string;
      actualTool?: string;
      correct: boolean;
      reasoning?: string;
      params?: any;
      suggestedResponse?: string;
      error?: string;
    }>;
  }> = [];

  for (const model of models) {
    try {
      console.log(`\n\nTesting ${model.name}...`);
      const results = await testLLMRouting(model.id, model.name);
      allResults.push({
        model: model.name,
        results
      });
      
      // Add delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      log(`Error testing ${model.name}`, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  // Compare results
  log("Model Comparison Summary", {
    models: allResults.map(m => ({
      model: m.model,
      accuracy: `${(m.results.filter((r: any) => r.correct).length / m.results.length * 100).toFixed(1)}%`,
      errors: m.results.filter((r: any) => r.error).length
    }))
  });
}

async function runAllTests() {
  console.log("RISE TG Bot - LLM Routing Tests\n");
  
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("❌ OPENROUTER_API_KEY not set in environment");
    return;
  }
  
  // Test with default model
  await testLLMRouting("openai/gpt-4o-mini", "GPT-4o Mini (Default)");
  
  // Test complex parsing
  await testComplexPromptParsing();
  
  // Compare models (optional - comment out to save API calls)
  // await testModelComparison();
  
  console.log("\n✅ All LLM routing tests completed!");
}

// Run tests
runAllTests().catch(console.error);