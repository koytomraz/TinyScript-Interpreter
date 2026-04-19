# TinyScript Interpreter

A hand-written mini programming-language interpreter built entirely in JavaScript — no external dependencies. It implements a complete pipeline from raw source text to execution output: **Lexer → Parser → AST → Interpreter**.

---

## Quick Start

```bash
# Run the built-in demo suite
node index.js

# Execute a TinyScript source file
node index.js examples/fibonacci.tiny

# Start the interactive REPL
node index.js --repl

# Debug: inspect the token stream
node index.js --tokens examples/basic.tiny

# Debug: inspect the AST
node index.js --ast examples/basic.tiny
```

---

## Language Features

| Feature | Syntax |
|---------|--------|
| Variable declaration | `let x = 5` |
| Re-assignment | `x = 10` |
| Arithmetic | `+  -  *  /` |
| Comparison | `==  !=  <  >  <=  >=` |
| Logical | `&&  \|\|  !` |
| String literals | `"hello"` or `'hello'` |
| Boolean literals | `true`  `false` |
| Conditionals | `if (cond) { } else if { } else { }` |
| While loop | `while (cond) { }` |
| Functions | `function name(a, b) { return a + b }` |
| Print | `print(value)` |
| Comments | `// single-line` |
| Closures | Inner functions capture outer variables |
| Recursion | Full support |

### Built-in functions

| Function | Description |
|----------|-------------|
| `print(v, ...)` | Print values to stdout |
| `type(v)` | Return the type name as a string |
| `str(v)` | Convert to string |
| `num(v)` | Convert to number |
| `sqrt(x)` | Square root |
| `abs(x)` | Absolute value |
| `floor(x)` | Floor (round down) |
| `max(a, b)` | Larger of two numbers |
| `min(a, b)` | Smaller of two numbers |

---

## Example Programs

### Hello World

```
print("Hello, World!")
```

### Variables and Arithmetic

```
let x = 5
let y = 10
let result = x + y
print(result)          // 15
```

### Conditionals

```
let score = 75

if (score >= 90) {
  print("Grade: A")
} else if (score >= 75) {
  print("Grade: B")
} else {
  print("Grade: F")
}
```

### While Loop

```
let i = 1
let sum = 0
while (i <= 100) {
  sum = sum + i
  i = i + 1
}
print(sum)             // 5050
```

### User-Defined Function

```
function factorial(n) {
  if (n <= 1) {
    return 1
  }
  return n * factorial(n - 1)
}

print(factorial(10))   // 3628800
```

### Closures

```
function makeCounter(start) {
  let count = start
  function next() {
    count = count + 1
    return count
  }
  return next
}

let counter = makeCounter(0)
print(counter())   // 1
print(counter())   // 2
print(counter())   // 3
```

---

## Project Structure

```
TinyScript Interpreter/
├── lexer.js          Tokenizer — converts source text to tokens
├── parser.js         Parser — converts tokens to an AST
├── ast.js            AST node factory functions
├── interpreter.js    Execution engine — walks the AST
├── environment.js    Variable scope / symbol table
├── index.js          CLI entry point and REPL
├── package.json
├── README.md
└── examples/
    ├── basic.tiny        Variables and arithmetic
    ├── conditionals.tiny if / else if / else
    ├── loops.tiny        while loops
    ├── functions.tiny    User-defined functions + recursion
    ├── fibonacci.tiny    Recursive and iterative Fibonacci
    └── closures.tiny     Closures and nested functions
```

---

## Architecture Deep-Dive

### 1. Tokenization (Lexer)

**File:** `lexer.js`

The `Lexer` class reads the source string character-by-character and groups
characters into `Token` objects. Each token has three fields:

```
Token { type, value, line }
```

**Token types**

| Category | Types |
|----------|-------|
| Literals | `NUMBER` `STRING` `BOOLEAN` |
| Names | `IDENTIFIER` `KEYWORD` |
| Arithmetic | `PLUS` `MINUS` `STAR` `SLASH` |
| Assignment | `ASSIGN` (=) |
| Comparison | `EQ` `NEQ` `LT` `GT` `LTE` `GTE` |
| Logical | `AND` `OR` `NOT` |
| Delimiters | `LPAREN` `RPAREN` `LBRACE` `RBRACE` `COMMA` `SEMICOLON` |
| Sentinel | `EOF` |

**Keywords:**  `let`  `if`  `else`  `while`  `function`  `return`

`true` and `false` are tokenized directly as `BOOLEAN` tokens (not keywords).

**Example** — input `let x = 5 + 3`:

```
KEYWORD    'let'
IDENTIFIER 'x'
ASSIGN     '='
NUMBER     5
PLUS       '+'
NUMBER     3
EOF
```

---

### 2. Parsing (Parser)

**File:** `parser.js`

The `Parser` implements a **recursive-descent parser** that follows a formal
grammar to produce an Abstract Syntax Tree (AST).

**Expression precedence** (lowest → highest):

```
assignment
  logicalOr   (||)
    logicalAnd  (&&)
      equality    (== !=)
        comparison  (< > <= >=)
          addition    (+ -)
            multiplication  (* /)
              unary     (- !)
                callExpr  (f(args))
                  primary   (literal | identifier | (expr))
```

Higher-priority rules are called deeper in the recursion, which naturally
makes them bind more tightly. For example, `1 + 2 * 3` is parsed as
`1 + (2 * 3)` because `parseMultiplication` is called from within
`parseAddition`.

---

### 3. AST Structure

**File:** `ast.js`

Every AST node is a plain JavaScript object with a `type` string:

```js
// let result = x + y
{
  type: "VariableDeclaration",
  name: "result",
  init: {
    type: "BinaryExpression",
    operator: "+",
    left:  { type: "Identifier", name: "x" },
    right: { type: "Identifier", name: "y" }
  }
}
```

**Node catalogue:**

| Node type | Fields |
|-----------|--------|
| `Program` | `body: Statement[]` |
| `VariableDeclaration` | `name, init` |
| `AssignmentExpression` | `name, value` |
| `BinaryExpression` | `operator, left, right` |
| `LogicalExpression` | `operator, left, right` |
| `UnaryExpression` | `operator, operand` |
| `Identifier` | `name` |
| `NumericLiteral` | `value` |
| `BooleanLiteral` | `value` |
| `StringLiteral` | `value` |
| `IfStatement` | `condition, consequent, alternate` |
| `WhileStatement` | `condition, body` |
| `FunctionDeclaration` | `name, params, body` |
| `CallExpression` | `callee, args` |
| `ReturnStatement` | `value` |
| `BlockStatement` | `body: Statement[]` |
| `ExpressionStatement` | `expression` |

---

### 4. Execution Flow (Interpreter)

**File:** `interpreter.js`

The `Interpreter` performs a **tree-walk** over the AST — each node type is
handled by a dedicated `_eval*` method dispatched through `_evalNode()`.

#### Variable storage

Variables are stored in `Environment` objects (see `environment.js`).
Environments form a **linked chain** (parent pointer) to implement
**lexical scoping**:

```
globalEnv
  └─ functionEnv    ← created per function call; holds parameters
       └─ blockEnv  ← created per if/while block; holds local lets
```

- `env.define(name, value)` — bind a new variable in *this* scope  
- `env.get(name)` — find a variable; walks up the chain if needed  
- `env.set(name, value)` — update an existing variable; walks up to where it was declared

#### Function calls

1. Evaluate all arguments left-to-right.
2. Look up the callee name in the current environment.
3. Create `fnEnv = closure.extend()` (extends the *closure* scope, not the call site — this gives **lexical** rather than dynamic scoping).
4. Bind each parameter in `fnEnv`.
5. Execute the function body in `fnEnv`.
6. Unwrap any `ReturnSignal` and return its value.

#### Return statement

`return` is implemented through a `ReturnSignal` sentinel object. When
`_evalReturn` is called it wraps the return value in a `ReturnSignal` and
returns it. Every `_evalBlock` call propagates `ReturnSignal` upward
immediately (short-circuits the loop). `_evalCall` unwraps it back to a
plain value.

#### Short-circuit evaluation

`&&` evaluates its right operand only when the left is truthy.  
`||` evaluates its right operand only when the left is falsy.

#### Truthiness rules

| Value | Truthiness |
|-------|-----------|
| `false` | falsy |
| `0` | falsy |
| `""` (empty string) | falsy |
| `null` | falsy |
| everything else | truthy |

#### String concatenation

When the `+` operator has at least one string operand, both sides are
converted to strings and concatenated. Numeric addition is used otherwise.

---

## REPL

```
$ node index.js --repl

tiny> let x = 10
tiny> let y = 20
tiny> print(x + y)
30
tiny> function double(n) { return n * 2 }
tiny> print(double(x))
20
tiny> exit
```

Variables and functions defined in one line persist for the entire session.

---

## Extending the Language

The interpreter is intentionally small; here are suggested next steps:

- **Arrays** — add `ArrayLiteral` and `IndexExpression` AST nodes, handle `[]` in the lexer
- **For loops** — add `ForStatement` (init; condition; update) to the parser
- **Null literal** — add a `null` keyword tokenized as `NullLiteral`
- **Multi-line strings / template strings** — extend the lexer's `_readString`
- **Standard library** — register more built-ins inside `_registerBuiltins`
- **Error recovery** — catch parse errors and continue to the next statement
- **Type checker** — add a static-analysis pass between parsing and execution
