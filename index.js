/**
 * index.js — TinyScript Interpreter Entry Point
 *
 * Usage
 * ─────
 *   node index.js                   Run the built-in demo programs
 *   node index.js <file.tiny>       Run a TinyScript source file
 *   node index.js --repl            Start the interactive REPL
 *   node index.js --tokens <file>   Print the token stream (debug)
 *   node index.js --ast <file>      Print the AST (debug)
 */

'use strict';

const fs       = require('fs');
const path     = require('path');
const readline = require('readline');

const { Lexer }       = require('./lexer');
const { Parser }      = require('./parser');
const { Interpreter } = require('./interpreter');

// ─── Core pipeline ─────────────────────────────────────────────────────────────

/**
 * Tokenize, parse and run a source string.
 *
 * @param {string}   source      TinyScript source code.
 * @param {object}   [options]
 * @param {function} [options.output]       Where print() sends its output.
 * @param {Interpreter} [options.interpreter]  Reuse an existing interpreter
 *                                              (preserves environment across calls).
 * @returns {*} The value of the last expression, or null.
 */
function run(source, options = {}) {
  const lexer  = new Lexer(source);
  const tokens = lexer.tokenize();

  const parser = new Parser(tokens);
  const ast    = parser.parse();

  const interp = options.interpreter || new Interpreter({ output: options.output });
  return interp.run(ast);
}

// ─── File runner ───────────────────────────────────────────────────────────────

function runFile(filePath) {
  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    console.error(`Error: file not found — ${resolved}`);
    process.exit(1);
  }

  const source = fs.readFileSync(resolved, 'utf-8');

  try {
    run(source);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

// ─── Debug helpers ─────────────────────────────────────────────────────────────

function printTokens(filePath) {
  const source = fs.readFileSync(path.resolve(filePath), 'utf-8');
  const tokens = new Lexer(source).tokenize();
  console.log(`\nTokens for: ${filePath}\n${'─'.repeat(50)}`);
  tokens.forEach(t => console.log(t.toString()));
}

function printAST(filePath) {
  const source = fs.readFileSync(path.resolve(filePath), 'utf-8');
  const tokens = new Lexer(source).tokenize();
  const ast    = new Parser(tokens).parse();
  console.log(`\nAST for: ${filePath}\n${'─'.repeat(50)}`);
  console.log(JSON.stringify(ast, null, 2));
}

// ─── REPL ──────────────────────────────────────────────────────────────────────

function startREPL() {
  // One interpreter lives for the whole REPL session so variables persist
  // across inputs, just like a Python or Node.js REPL.
  const interp = new Interpreter();

  const rl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout,
    prompt: 'tiny> ',
  });

  console.log('┌─────────────────────────────────────────┐');
  console.log('│   TinyScript REPL  (v1.0.0)             │');
  console.log('│   Type "exit" or press Ctrl+C to quit   │');
  console.log('└─────────────────────────────────────────┘');
  rl.prompt();

  rl.on('line', (line) => {
    const input = line.trim();

    if (input === 'exit' || input === 'quit') {
      console.log('Goodbye!');
      process.exit(0);
    }

    if (!input) {
      rl.prompt();
      return;
    }

    try {
      const result = run(input, { interpreter: interp });

      // Only show a return value when it is meaningful (not null / undefined).
      if (result !== null && result !== undefined) {
        console.log(`=> ${result}`);
      }
    } catch (err) {
      console.error(err.message);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log('\nGoodbye!');
    process.exit(0);
  });
}

// ─── Built-in demo ─────────────────────────────────────────────────────────────

function runDemo() {
  const separator = (title) =>
    console.log(`\n${'═'.repeat(50)}\n  ${title}\n${'═'.repeat(50)}`);

  // ── Demo 1: Basic variables & arithmetic ──────────────────────────────────
  separator('Demo 1 — Variables and Arithmetic');
  run(`
let x = 5
let y = 10
let result = x + y
print(result)
  `);

  // ── Demo 2: String values & concatenation ─────────────────────────────────
  separator('Demo 2 — Strings and Concatenation');
  run(`
let name = "TinyScript"
let greeting = "Hello, " + name + "!"
print(greeting)
  `);

  // ── Demo 3: Conditionals ──────────────────────────────────────────────────
  separator('Demo 3 — Conditionals (if / else if / else)');
  run(`
let score = 75

if (score >= 90) {
  print("Grade: A")
} else if (score >= 75) {
  print("Grade: B")
} else if (score >= 60) {
  print("Grade: C")
} else {
  print("Grade: F")
}
  `);

  // ── Demo 4: While loop ────────────────────────────────────────────────────
  separator('Demo 4 — While Loop (sum 1..10)');
  run(`
let i   = 1
let sum = 0
while (i <= 10) {
  sum = sum + i
  i   = i + 1
}
print(sum)
  `);

  // ── Demo 5: Functions ─────────────────────────────────────────────────────
  separator('Demo 5 — User-Defined Functions');
  run(`
function greet(name) {
  return "Hello, " + name + "!"
}

function add(a, b) {
  return a + b
}

print(greet("World"))
print(add(3, 7))
  `);

  // ── Demo 6: Recursion — factorial ────────────────────────────────────────
  separator('Demo 6 — Recursion (factorial)');
  run(`
function factorial(n) {
  if (n <= 1) {
    return 1
  }
  return n * factorial(n - 1)
}

print(factorial(1))
print(factorial(5))
print(factorial(10))
  `);

  // ── Demo 7: Recursion — Fibonacci ────────────────────────────────────────
  separator('Demo 7 — Recursion (Fibonacci sequence)');
  run(`
function fib(n) {
  if (n <= 1) {
    return n
  }
  return fib(n - 1) + fib(n - 2)
}

let i = 0
while (i <= 10) {
  print(fib(i))
  i = i + 1
}
  `);

  // ── Demo 8: Boolean logic ─────────────────────────────────────────────────
  separator('Demo 8 — Boolean Logic');
  run(`
let a = true
let b = false

print(a && b)
print(a || b)
print(!a)

let x = 5
print(x > 3 && x < 10)
  `);

  // ── Demo 9: Closures ──────────────────────────────────────────────────────
  separator('Demo 9 — Closures');
  run(`
function makeCounter(start) {
  let count = start
  function next() {
    count = count + 1
    return count
  }
  return next
}

let counter = makeCounter(0)
print(counter())
print(counter())
print(counter())
  `);

  console.log('\n' + '═'.repeat(50));
  console.log('  Run  node index.js --repl  for an interactive session.');
  console.log('  Run  node index.js <file.tiny>  to execute a file.');
  console.log('═'.repeat(50) + '\n');
}

// ─── CLI dispatch ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args[0] === '--repl' || args[0] === '-r') {
  startREPL();
} else if (args[0] === '--tokens' && args[1]) {
  printTokens(args[1]);
} else if (args[0] === '--ast' && args[1]) {
  printAST(args[1]);
} else if (args[0] && !args[0].startsWith('-')) {
  runFile(args[0]);
} else {
  runDemo();
}

module.exports = { run };
