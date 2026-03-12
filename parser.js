/**
 * parser.js — Recursive-Descent Parser
 *
 * Converts the flat token array produced by the Lexer into an Abstract
 * Syntax Tree (AST) by following the grammar below.
 *
 * Grammar (simplified BNF)
 * ────────────────────────
 *  program        → statement* EOF
 *
 *  statement      → varDecl
 *                 | ifStmt
 *                 | whileStmt
 *                 | funcDecl
 *                 | returnStmt
 *                 | exprStmt
 *
 *  varDecl        → "let" IDENTIFIER "=" expression
 *  ifStmt         → "if" "(" expression ")" block ( "else" (ifStmt | block) )?
 *  whileStmt      → "while" "(" expression ")" block
 *  funcDecl       → "function" IDENTIFIER "(" params? ")" block
 *  returnStmt     → "return" expression?
 *  exprStmt       → expression
 *
 *  block          → "{" statement* "}"
 *  params         → IDENTIFIER ( "," IDENTIFIER )*
 *
 *  expression     → assignment
 *  assignment     → IDENTIFIER "=" assignment  |  logicalOr
 *  logicalOr      → logicalAnd  ( "||" logicalAnd )*
 *  logicalAnd     → equality    ( "&&" equality  )*
 *  equality       → comparison  ( ("==" | "!=") comparison )*
 *  comparison     → addition    ( ("<" | ">" | "<=" | ">=") addition )*
 *  addition       → multiply    ( ("+" | "-") multiply )*
 *  multiply       → unary       ( ("*" | "/") unary )*
 *  unary          → ("!" | "-") unary  |  callExpr
 *  callExpr       → primary ( "(" arguments? ")" )*
 *  primary        → NUMBER | STRING | BOOLEAN | IDENTIFIER | "(" expression ")"
 *  arguments      → expression ( "," expression )*
 */

'use strict';

const { TokenType } = require('./lexer');
const AST = require('./ast');

class Parser {
  /**
   * @param {import('./lexer').Token[]} tokens  Token stream from the Lexer.
   */
  constructor(tokens) {
    this.tokens = tokens;
    this.pos    = 0;
  }

  // ── Error helper ──────────────────────────────────────────────────────────

  _error(msg) {
    const tok = this._current();
    throw new SyntaxError(
      `[Parser] Line ${tok.line}: ${msg} (got ${tok.type} '${tok.value}')`
    );
  }

  // ── Token navigation ──────────────────────────────────────────────────────

  _current() {
    return this.tokens[this.pos];
  }

  _advance() {
    const tok = this.tokens[this.pos];
    if (tok.type !== TokenType.EOF) this.pos++;
    return tok;
  }

  /** True if the current token matches type (and optionally value). */
  _check(type, value = null) {
    const tok = this._current();
    if (tok.type !== type) return false;
    return value === null || tok.value === value;
  }

  /** Consume and return the current token; throw if it doesn't match. */
  _expect(type, value = null) {
    if (!this._check(type, value)) {
      const label = value !== null ? `'${value}'` : type;
      this._error(`Expected ${label}`);
    }
    return this._advance();
  }

  /** Consume and return the current token only if it matches; else null. */
  _match(type, value = null) {
    return this._check(type, value) ? this._advance() : null;
  }

  /** Skip any number of optional semicolons (statement separators). */
  _skipSemicolons() {
    while (this._check(TokenType.SEMICOLON)) this._advance();
  }

  // ── Top-level ─────────────────────────────────────────────────────────────

  /**
   * Parse the entire token stream and return a Program node.
   */
  parse() {
    const body = [];

    while (!this._check(TokenType.EOF)) {
      this._skipSemicolons();
      if (this._check(TokenType.EOF)) break;
      body.push(this._parseStatement());
      this._skipSemicolons();
    }

    return AST.Program(body);
  }

  // ── Statements ────────────────────────────────────────────────────────────

  _parseStatement() {
    const tok = this._current();

    if (tok.type === TokenType.KEYWORD) {
      switch (tok.value) {
        case 'let':      return this._parseVarDecl();
        case 'if':       return this._parseIfStmt();
        case 'while':    return this._parseWhileStmt();
        case 'function': return this._parseFuncDecl();
        case 'return':   return this._parseReturnStmt();
      }
    }

    return this._parseExprStmt();
  }

  _parseVarDecl() {
    this._expect(TokenType.KEYWORD, 'let');
    const name = this._expect(TokenType.IDENTIFIER).value;
    this._expect(TokenType.ASSIGN);
    const init = this._parseExpression();
    return AST.VariableDeclaration(name, init);
  }

  _parseIfStmt() {
    this._expect(TokenType.KEYWORD, 'if');
    this._expect(TokenType.LPAREN);
    const condition = this._parseExpression();
    this._expect(TokenType.RPAREN);

    const consequent = this._parseBlock();

    let alternate = null;
    if (this._match(TokenType.KEYWORD, 'else')) {
      // else if  →  chain into another IfStatement node
      if (this._check(TokenType.KEYWORD, 'if')) {
        alternate = this._parseIfStmt();
      } else {
        alternate = this._parseBlock();
      }
    }

    return AST.IfStatement(condition, consequent, alternate);
  }

  _parseWhileStmt() {
    this._expect(TokenType.KEYWORD, 'while');
    this._expect(TokenType.LPAREN);
    const condition = this._parseExpression();
    this._expect(TokenType.RPAREN);
    const body = this._parseBlock();
    return AST.WhileStatement(condition, body);
  }

  _parseFuncDecl() {
    this._expect(TokenType.KEYWORD, 'function');
    const name = this._expect(TokenType.IDENTIFIER).value;

    this._expect(TokenType.LPAREN);

    const params = [];
    if (!this._check(TokenType.RPAREN)) {
      params.push(this._expect(TokenType.IDENTIFIER).value);
      while (this._match(TokenType.COMMA)) {
        params.push(this._expect(TokenType.IDENTIFIER).value);
      }
    }

    this._expect(TokenType.RPAREN);
    const body = this._parseBlock();

    return AST.FunctionDeclaration(name, params, body);
  }

  _parseReturnStmt() {
    this._expect(TokenType.KEYWORD, 'return');

    // A return statement may have no value when followed by }, ; or EOF.
    let value = null;
    if (
      !this._check(TokenType.RBRACE) &&
      !this._check(TokenType.SEMICOLON) &&
      !this._check(TokenType.EOF)
    ) {
      value = this._parseExpression();
    }

    return AST.ReturnStatement(value);
  }

  _parseExprStmt() {
    const expr = this._parseExpression();
    return AST.ExpressionStatement(expr);
  }

  _parseBlock() {
    this._expect(TokenType.LBRACE);

    const body = [];
    this._skipSemicolons();

    while (!this._check(TokenType.RBRACE) && !this._check(TokenType.EOF)) {
      body.push(this._parseStatement());
      this._skipSemicolons();
    }

    this._expect(TokenType.RBRACE);
    return AST.BlockStatement(body);
  }

  // ── Expressions (operator-precedence climb) ───────────────────────────────
  //
  //  Lowest precedence                        Highest precedence
  //  assignment → logicalOr → logicalAnd → equality → comparison
  //  → addition → multiply → unary → callExpr → primary

  _parseExpression() {
    return this._parseAssignment();
  }

  _parseAssignment() {
    const left = this._parseLogicalOr();

    if (this._check(TokenType.ASSIGN)) {
      this._advance();
      if (left.type !== 'Identifier') {
        throw new SyntaxError('[Parser] Invalid assignment target: left-hand side must be a variable name');
      }
      const value = this._parseAssignment(); // right-associative
      return AST.AssignmentExpression(left.name, value);
    }

    return left;
  }

  _parseLogicalOr() {
    let left = this._parseLogicalAnd();

    while (this._check(TokenType.OR)) {
      const op    = this._advance().value;
      const right = this._parseLogicalAnd();
      left = AST.LogicalExpression(op, left, right);
    }

    return left;
  }

  _parseLogicalAnd() {
    let left = this._parseEquality();

    while (this._check(TokenType.AND)) {
      const op    = this._advance().value;
      const right = this._parseEquality();
      left = AST.LogicalExpression(op, left, right);
    }

    return left;
  }

  _parseEquality() {
    let left = this._parseComparison();

    while (this._check(TokenType.EQ) || this._check(TokenType.NEQ)) {
      const op    = this._advance().value;
      const right = this._parseComparison();
      left = AST.BinaryExpression(op, left, right);
    }

    return left;
  }

  _parseComparison() {
    let left = this._parseAddition();

    while (
      this._check(TokenType.LT)  || this._check(TokenType.GT) ||
      this._check(TokenType.LTE) || this._check(TokenType.GTE)
    ) {
      const op    = this._advance().value;
      const right = this._parseAddition();
      left = AST.BinaryExpression(op, left, right);
    }

    return left;
  }

  _parseAddition() {
    let left = this._parseMultiplication();

    while (this._check(TokenType.PLUS) || this._check(TokenType.MINUS)) {
      const op    = this._advance().value;
      const right = this._parseMultiplication();
      left = AST.BinaryExpression(op, left, right);
    }

    return left;
  }

  _parseMultiplication() {
    let left = this._parseUnary();

    while (this._check(TokenType.STAR) || this._check(TokenType.SLASH)) {
      const op    = this._advance().value;
      const right = this._parseUnary();
      left = AST.BinaryExpression(op, left, right);
    }

    return left;
  }

  _parseUnary() {
    if (this._check(TokenType.NOT) || this._check(TokenType.MINUS)) {
      const op      = this._advance().value;
      const operand = this._parseUnary(); // right-recursive for chaining: !!x
      return AST.UnaryExpression(op, operand);
    }

    return this._parseCallExpr();
  }

  _parseCallExpr() {
    let expr = this._parsePrimary();

    // Allow chained calls: f(1)(2)  (uncommon but handled gracefully)
    while (this._check(TokenType.LPAREN)) {
      this._advance(); // consume '('

      const args = [];
      if (!this._check(TokenType.RPAREN)) {
        args.push(this._parseExpression());
        while (this._match(TokenType.COMMA)) {
          args.push(this._parseExpression());
        }
      }

      this._expect(TokenType.RPAREN);

      if (expr.type !== 'Identifier') {
        throw new SyntaxError('[Parser] Only named functions can be called');
      }

      expr = AST.CallExpression(expr.name, args);
    }

    return expr;
  }

  _parsePrimary() {
    const tok = this._current();

    // Numeric literal
    if (tok.type === TokenType.NUMBER) {
      this._advance();
      return AST.NumericLiteral(tok.value);
    }

    // String literal
    if (tok.type === TokenType.STRING) {
      this._advance();
      return AST.StringLiteral(tok.value);
    }

    // Boolean literal
    if (tok.type === TokenType.BOOLEAN) {
      this._advance();
      return AST.BooleanLiteral(tok.value);
    }

    // Identifier (variables, built-in names like `print`)
    if (tok.type === TokenType.IDENTIFIER) {
      this._advance();
      return AST.Identifier(tok.value);
    }

    // Grouped expression  (expr)
    if (tok.type === TokenType.LPAREN) {
      this._advance();
      const expr = this._parseExpression();
      this._expect(TokenType.RPAREN);
      return expr;
    }

    this._error(`Unexpected token`);
  }
}

module.exports = { Parser };
