/**
 * interpreter.js — AST Interpreter (Tree-Walk Execution Engine)
 *
 * Walks the AST produced by the Parser and evaluates the program.
 *
 * Key design points
 * ─────────────────
 * • Every node type is dispatched through evalNode() using a switch.
 * • Variable storage is delegated to Environment (see environment.js).
 * • Functions are first-class values represented by TinyFunction objects
 *   that capture their closure (definition-time environment).
 * • `return` is implemented via a ReturnSignal sentinel value that bubbles
 *   up the call stack until caught by a function-call handler.
 * • `print` and other built-ins are registered as BuiltinFunction objects
 *   in the global environment at startup.
 * • Short-circuit evaluation is used for && and ||.
 * • String concatenation is triggered when either operand of + is a string.
 */

'use strict';

const { Environment } = require('./environment');

// ─── Internal signal for return ───────────────────────────────────────────────

/**
 * Thrown (not literally — it is returned) when a `return` statement is hit.
 * Unwrapped by evalCallExpr once it reaches the function boundary.
 */
class ReturnSignal {
  constructor(value) {
    this.value = value;
  }
}

// ─── Function representations ─────────────────────────────────────────────────

class BuiltinFunction {
  constructor(name, fn) {
    this.name = name;
    this.fn   = fn;
  }

  toString() {
    return `<builtin ${this.name}>`;
  }
}

class TinyFunction {
  /**
   * @param {string}      name     The function's name (for error messages).
   * @param {string[]}    params   Formal parameter names.
   * @param {object}      body     BlockStatement AST node.
   * @param {Environment} closure  The environment captured at definition time.
   */
  constructor(name, params, body, closure) {
    this.name    = name;
    this.params  = params;
    this.body    = body;
    this.closure = closure;
  }

  toString() {
    return `<function ${this.name}>`;
  }
}

// ─── Interpreter ──────────────────────────────────────────────────────────────

class Interpreter {
  /**
   * @param {object} options
   * @param {function} [options.output=console.log]  Sink for print() output.
   */
  constructor(options = {}) {
    this.output    = options.output || ((s) => console.log(s));
    this.globalEnv = new Environment();
    this._registerBuiltins();
  }

  // ── Built-in standard library ──────────────────────────────────────────────

  _registerBuiltins() {
    const env = this.globalEnv;

    // print(value, ...)  — variadic; converts every argument to a string
    env.define('print', new BuiltinFunction('print', (...args) => {
      this.output(args.map(a => this._stringify(a)).join(' '));
      return null;
    }));

    // type(value)  — returns the TinyScript type name as a string
    env.define('type', new BuiltinFunction('type', (val) => {
      if (val === null)                   return 'null';
      if (typeof val === 'boolean')       return 'boolean';
      if (typeof val === 'number')        return 'number';
      if (typeof val === 'string')        return 'string';
      if (val instanceof TinyFunction)    return 'function';
      if (val instanceof BuiltinFunction) return 'function';
      return 'unknown';
    }));

    // str(value)  — explicit conversion to string
    env.define('str', new BuiltinFunction('str', (val) => this._stringify(val)));

    // num(value)  — explicit conversion to number
    env.define('num', new BuiltinFunction('num', (val) => {
      const n = Number(val);
      if (isNaN(n)) throw new TypeError(`[Runtime] Cannot convert '${val}' to a number`);
      return n;
    }));

    // sqrt(x)  — square root
    env.define('sqrt', new BuiltinFunction('sqrt', (val) => {
      if (typeof val !== 'number') throw new TypeError('[Runtime] sqrt() requires a number');
      return Math.sqrt(val);
    }));

    // abs(x)
    env.define('abs', new BuiltinFunction('abs', (val) => {
      if (typeof val !== 'number') throw new TypeError('[Runtime] abs() requires a number');
      return Math.abs(val);
    }));

    // floor(x)
    env.define('floor', new BuiltinFunction('floor', (val) => {
      if (typeof val !== 'number') throw new TypeError('[Runtime] floor() requires a number');
      return Math.floor(val);
    }));

    // max(a, b)
    env.define('max', new BuiltinFunction('max', (a, b) => Math.max(a, b)));

    // min(a, b)
    env.define('min', new BuiltinFunction('min', (a, b) => Math.min(a, b)));
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Execute a parsed Program AST.
   * Uses the persistent globalEnv so repeated calls (e.g. REPL) share state.
   */
  run(ast) {
    return this._evalNode(ast, this.globalEnv);
  }

  // ── Node dispatcher ───────────────────────────────────────────────────────

  _evalNode(node, env) {
    switch (node.type) {
      case 'Program':             return this._evalProgram(node, env);
      case 'VariableDeclaration': return this._evalVarDecl(node, env);
      case 'AssignmentExpression':return this._evalAssignment(node, env);
      case 'BinaryExpression':    return this._evalBinary(node, env);
      case 'LogicalExpression':   return this._evalLogical(node, env);
      case 'UnaryExpression':     return this._evalUnary(node, env);
      case 'Identifier':          return env.get(node.name);
      case 'NumericLiteral':      return node.value;
      case 'BooleanLiteral':      return node.value;
      case 'StringLiteral':       return node.value;
      case 'IfStatement':         return this._evalIf(node, env);
      case 'WhileStatement':      return this._evalWhile(node, env);
      case 'FunctionDeclaration': return this._evalFuncDecl(node, env);
      case 'CallExpression':      return this._evalCall(node, env);
      case 'ReturnStatement':     return this._evalReturn(node, env);
      case 'BlockStatement':      return this._evalBlock(node, env);
      case 'ExpressionStatement': return this._evalNode(node.expression, env);

      default:
        throw new Error(`[Interpreter] Unknown AST node type: '${node.type}'`);
    }
  }

  // ── Statement evaluation ──────────────────────────────────────────────────

  _evalProgram(node, env) {
    let result = null;
    for (const stmt of node.body) {
      result = this._evalNode(stmt, env);
      // A top-level return (rare) — unwrap and stop.
      if (result instanceof ReturnSignal) return result.value;
    }
    return result;
  }

  _evalVarDecl(node, env) {
    const value = this._evalNode(node.init, env);
    env.define(node.name, value);
    return value;
  }

  _evalAssignment(node, env) {
    const value = this._evalNode(node.value, env);
    env.set(node.name, value); // walks up to where the variable was declared
    return value;
  }

  _evalIf(node, env) {
    const cond = this._evalNode(node.condition, env);

    if (this._isTruthy(cond)) {
      return this._evalBlock(node.consequent, env.extend());
    }

    if (node.alternate !== null) {
      // else if  → delegate to _evalIf so we don't double-extend the env
      if (node.alternate.type === 'IfStatement') {
        return this._evalIf(node.alternate, env);
      }
      return this._evalBlock(node.alternate, env.extend());
    }

    return null;
  }

  _evalWhile(node, env) {
    let result = null;

    while (this._isTruthy(this._evalNode(node.condition, env))) {
      // Each iteration gets a fresh block scope so `let` inside is per-iteration.
      result = this._evalBlock(node.body, env.extend());

      // Propagate return signals out of the enclosing function.
      if (result instanceof ReturnSignal) return result;
    }

    return result;
  }

  _evalFuncDecl(node, env) {
    // Capture the current scope as the closure environment.
    const fn = new TinyFunction(node.name, node.params, node.body, env);
    env.define(node.name, fn);
    return fn;
  }

  _evalReturn(node, env) {
    const value = node.value !== null ? this._evalNode(node.value, env) : null;
    return new ReturnSignal(value);
  }

  _evalBlock(node, env) {
    let result = null;
    for (const stmt of node.body) {
      result = this._evalNode(stmt, env);
      // Bubble any return signal up immediately.
      if (result instanceof ReturnSignal) return result;
    }
    return result;
  }

  // ── Expression evaluation ─────────────────────────────────────────────────

  _evalBinary(node, env) {
    const left  = this._evalNode(node.left,  env);
    const right = this._evalNode(node.right, env);

    switch (node.operator) {
      case '+':
        // String concatenation when either side is a string.
        if (typeof left === 'string' || typeof right === 'string') {
          return this._stringify(left) + this._stringify(right);
        }
        return left + right;

      case '-':  return left - right;
      case '*':  return left * right;
      case '/':
        if (right === 0) throw new Error('[Runtime] Division by zero');
        return left / right;

      case '==': return left === right;
      case '!=': return left !== right;
      case '<':  return left < right;
      case '>':  return left > right;
      case '<=': return left <= right;
      case '>=': return left >= right;

      default:
        throw new Error(`[Interpreter] Unknown binary operator: '${node.operator}'`);
    }
  }

  _evalLogical(node, env) {
    const left = this._evalNode(node.left, env);

    if (node.operator === '&&') {
      // Short-circuit: if left is falsy, return left without evaluating right.
      return this._isTruthy(left) ? this._evalNode(node.right, env) : left;
    }

    if (node.operator === '||') {
      // Short-circuit: if left is truthy, return left without evaluating right.
      return this._isTruthy(left) ? left : this._evalNode(node.right, env);
    }

    throw new Error(`[Interpreter] Unknown logical operator: '${node.operator}'`);
  }

  _evalUnary(node, env) {
    const val = this._evalNode(node.operand, env);

    switch (node.operator) {
      case '-': return -val;
      case '!': return !this._isTruthy(val);
      default:
        throw new Error(`[Interpreter] Unknown unary operator: '${node.operator}'`);
    }
  }

  _evalCall(node, env) {
    // Resolve the callee name in the current environment.
    let callee;
    try {
      callee = env.get(node.callee);
    } catch (_) {
      throw new ReferenceError(`[Runtime] '${node.callee}' is not defined`);
    }

    // Evaluate all arguments left-to-right before the call.
    const args = node.args.map(arg => this._evalNode(arg, env));

    // ── Built-in function ──
    if (callee instanceof BuiltinFunction) {
      return callee.fn(...args);
    }

    // ── User-defined function ──
    if (callee instanceof TinyFunction) {
      if (args.length !== callee.params.length) {
        throw new Error(
          `[Runtime] '${node.callee}' expects ${callee.params.length} argument(s) but received ${args.length}`
        );
      }

      // Create a new scope that inherits from the closure (lexical scoping).
      const fnEnv = callee.closure.extend();
      for (let i = 0; i < callee.params.length; i++) {
        fnEnv.define(callee.params[i], args[i]);
      }

      const result = this._evalBlock(callee.body, fnEnv);

      // Unwrap the return signal; a function that falls off the end returns null.
      return result instanceof ReturnSignal ? result.value : result;
    }

    throw new TypeError(`[Runtime] '${node.callee}' is not a function`);
  }

  // ── Utilities ────────────────────────────────────────────────────────────

  /**
   * Truthiness rules:
   *  falsy  →  null, false, 0, ""
   *  truthy →  everything else
   */
  _isTruthy(value) {
    if (value === null || value === false) return false;
    if (typeof value === 'number' && value === 0) return false;
    if (typeof value === 'string' && value === '') return false;
    return true;
  }

  _stringify(value) {
    if (value === null)    return 'null';
    if (value === true)    return 'true';
    if (value === false)   return 'false';
    if (value instanceof TinyFunction || value instanceof BuiltinFunction) {
      return value.toString();
    }
    return String(value);
  }
}

module.exports = { Interpreter, TinyFunction, BuiltinFunction, ReturnSignal };
