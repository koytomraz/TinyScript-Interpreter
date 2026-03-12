/**
 * lexer.js — Tokenizer (Lexical Analyser)
 *
 * Converts raw source-code text into a flat array of Token objects
 * that the parser can consume one at a time.
 *
 * Token types
 * ───────────
 *  Literals  : NUMBER  STRING  BOOLEAN
 *  Names     : IDENTIFIER
 *  Keywords  : KEYWORD  (let if else while function return)
 *  Arithmetic: PLUS  MINUS  STAR  SLASH
 *  Comparison: EQ(==)  NEQ(!=)  LT(<)  GT(>)  LTE(<=)  GTE(>=)
 *  Assignment: ASSIGN(=)
 *  Logical   : AND(&&)  OR(||)  NOT(!)
 *  Grouping  : LPAREN  RPAREN  LBRACE  RBRACE
 *  Misc      : COMMA  SEMICOLON
 *  End       : EOF
 *
 * Notes
 * ─────
 * • `true` and `false` are tokenized directly as BOOLEAN (not KEYWORD).
 * • `print` is a regular IDENTIFIER — it is resolved as a built-in at
 *   runtime, not at parse time.
 * • Single-line comments start with `//` and are silently discarded.
 */

'use strict';

// ─── Token Types ────────────────────────────────────────────────────────────

const TokenType = {
  // Literals
  NUMBER:     'NUMBER',
  STRING:     'STRING',
  BOOLEAN:    'BOOLEAN',

  // Names
  IDENTIFIER: 'IDENTIFIER',
  KEYWORD:    'KEYWORD',

  // Arithmetic operators
  PLUS:  'PLUS',   // +
  MINUS: 'MINUS',  // -
  STAR:  'STAR',   // *
  SLASH: 'SLASH',  // /

  // Assignment
  ASSIGN: 'ASSIGN', // =

  // Comparison operators
  EQ:  'EQ',   // ==
  NEQ: 'NEQ',  // !=
  LT:  'LT',   // <
  GT:  'GT',   // >
  LTE: 'LTE',  // <=
  GTE: 'GTE',  // >=

  // Logical operators
  AND: 'AND',  // &&
  OR:  'OR',   // ||
  NOT: 'NOT',  // !

  // Delimiters
  LPAREN:    'LPAREN',    // (
  RPAREN:    'RPAREN',    // )
  LBRACE:    'LBRACE',    // {
  RBRACE:    'RBRACE',    // }
  COMMA:     'COMMA',     // ,
  SEMICOLON: 'SEMICOLON', // ;

  // End-of-file sentinel
  EOF: 'EOF',
};

// Reserved words — `true`/`false` are handled separately as BOOLEAN tokens.
const KEYWORDS = new Set(['let', 'if', 'else', 'while', 'function', 'return']);

// ─── Token ──────────────────────────────────────────────────────────────────

class Token {
  /**
   * @param {string} type   One of the TokenType constants.
   * @param {*}      value  The literal value (number, string, boolean, etc.).
   * @param {number} line   1-based source line number (for error messages).
   */
  constructor(type, value, line) {
    this.type  = type;
    this.value = value;
    this.line  = line;
  }

  toString() {
    return `Token(${this.type}, ${JSON.stringify(this.value)}, L${this.line})`;
  }
}

// ─── Lexer ───────────────────────────────────────────────────────────────────

class Lexer {
  /**
   * @param {string} source  The complete source-code string to tokenize.
   */
  constructor(source) {
    this.source = source;
    this.pos    = 0;       // current character index
    this.line   = 1;       // current 1-based line number
    this.tokens = [];
  }

  // ── Error helper ──────────────────────────────────────────────────────────

  _error(msg) {
    throw new SyntaxError(`[Lexer] Line ${this.line}: ${msg}`);
  }

  // ── Character helpers ─────────────────────────────────────────────────────

  _peek(offset = 0) {
    return this.source[this.pos + offset];
  }

  _advance() {
    const ch = this.source[this.pos++];
    if (ch === '\n') this.line++;
    return ch;
  }

  /** Consume the next character only if it equals `expected`. */
  _match(expected) {
    if (this.pos < this.source.length && this.source[this.pos] === expected) {
      this.pos++;
      return true;
    }
    return false;
  }

  // ── Skip whitespace and single-line comments ──────────────────────────────

  _skipWhitespaceAndComments() {
    while (this.pos < this.source.length) {
      const ch = this._peek();

      if (ch === ' ' || ch === '\r' || ch === '\t' || ch === '\n') {
        this._advance();
        continue;
      }

      // Single-line comment: // … until end of line
      if (ch === '/' && this._peek(1) === '/') {
        while (this.pos < this.source.length && this._peek() !== '\n') {
          this._advance();
        }
        continue;
      }

      break;
    }
  }

  // ── Scanning helpers ──────────────────────────────────────────────────────

  _readNumber() {
    let raw = '';
    let hasDot = false;

    while (this.pos < this.source.length) {
      const ch = this._peek();
      if (ch >= '0' && ch <= '9') {
        raw += this._advance();
      } else if (ch === '.' && !hasDot && this._peek(1) >= '0' && this._peek(1) <= '9') {
        hasDot = true;
        raw += this._advance();
      } else {
        break;
      }
    }

    const value = hasDot ? parseFloat(raw) : parseInt(raw, 10);
    if (isNaN(value)) this._error(`Invalid number: ${raw}`);
    return value;
  }

  _readString(quote) {
    let str = '';

    while (this.pos < this.source.length && this._peek() !== quote) {
      const ch = this._advance();

      if (ch === '\\') {
        const escaped = this._advance();
        switch (escaped) {
          case 'n':  str += '\n'; break;
          case 't':  str += '\t'; break;
          case 'r':  str += '\r'; break;
          case '\\': str += '\\'; break;
          case '"':  str += '"';  break;
          case "'":  str += "'";  break;
          default:   str += '\\' + escaped; break;
        }
      } else {
        str += ch;
      }
    }

    if (this.pos >= this.source.length) {
      this._error('Unterminated string literal');
    }

    this._advance(); // consume the closing quote
    return str;
  }

  _readIdentifier() {
    let id = '';
    while (this.pos < this.source.length && /[a-zA-Z0-9_]/.test(this._peek())) {
      id += this._advance();
    }
    return id;
  }

  // ── Main tokenize loop ────────────────────────────────────────────────────

  /**
   * Scan the entire source string and return an array of Token objects.
   * The last token is always EOF.
   */
  tokenize() {
    while (this.pos < this.source.length) {
      this._skipWhitespaceAndComments();
      if (this.pos >= this.source.length) break;

      const line = this.line;
      const ch   = this._peek();

      // ── Numbers ───────────────────────────────────────────────────────────
      if (ch >= '0' && ch <= '9') {
        const value = this._readNumber();
        this.tokens.push(new Token(TokenType.NUMBER, value, line));
        continue;
      }

      // ── Strings ───────────────────────────────────────────────────────────
      if (ch === '"' || ch === "'") {
        this._advance(); // consume the opening quote
        const value = this._readString(ch);
        this.tokens.push(new Token(TokenType.STRING, value, line));
        continue;
      }

      // ── Identifiers, keywords and boolean literals ────────────────────────
      if (/[a-zA-Z_]/.test(ch)) {
        const id = this._readIdentifier();

        if (id === 'true' || id === 'false') {
          this.tokens.push(new Token(TokenType.BOOLEAN, id === 'true', line));
        } else if (KEYWORDS.has(id)) {
          this.tokens.push(new Token(TokenType.KEYWORD, id, line));
        } else {
          this.tokens.push(new Token(TokenType.IDENTIFIER, id, line));
        }
        continue;
      }

      // ── Operators and delimiters ──────────────────────────────────────────
      this._advance(); // consume the character before the switch

      switch (ch) {
        case '+': this.tokens.push(new Token(TokenType.PLUS,   '+', line)); break;
        case '-': this.tokens.push(new Token(TokenType.MINUS,  '-', line)); break;
        case '*': this.tokens.push(new Token(TokenType.STAR,   '*', line)); break;
        case '/': this.tokens.push(new Token(TokenType.SLASH,  '/', line)); break;
        case '(': this.tokens.push(new Token(TokenType.LPAREN, '(', line)); break;
        case ')': this.tokens.push(new Token(TokenType.RPAREN, ')', line)); break;
        case '{': this.tokens.push(new Token(TokenType.LBRACE, '{', line)); break;
        case '}': this.tokens.push(new Token(TokenType.RBRACE, '}', line)); break;
        case ',': this.tokens.push(new Token(TokenType.COMMA,  ',', line)); break;
        case ';': this.tokens.push(new Token(TokenType.SEMICOLON, ';', line)); break;

        case '=':
          this.tokens.push(this._match('=')
            ? new Token(TokenType.EQ,     '==', line)
            : new Token(TokenType.ASSIGN, '=',  line));
          break;

        case '!':
          this.tokens.push(this._match('=')
            ? new Token(TokenType.NEQ, '!=', line)
            : new Token(TokenType.NOT, '!',  line));
          break;

        case '<':
          this.tokens.push(this._match('=')
            ? new Token(TokenType.LTE, '<=', line)
            : new Token(TokenType.LT,  '<',  line));
          break;

        case '>':
          this.tokens.push(this._match('=')
            ? new Token(TokenType.GTE, '>=', line)
            : new Token(TokenType.GT,  '>',  line));
          break;

        case '&':
          if (this._match('&')) {
            this.tokens.push(new Token(TokenType.AND, '&&', line));
          } else {
            this._error("Expected '&&' — single '&' is not supported");
          }
          break;

        case '|':
          if (this._match('|')) {
            this.tokens.push(new Token(TokenType.OR, '||', line));
          } else {
            this._error("Expected '||' — single '|' is not supported");
          }
          break;

        default:
          this._error(`Unexpected character: '${ch}'`);
      }
    }

    this.tokens.push(new Token(TokenType.EOF, null, this.line));
    return this.tokens;
  }
}

module.exports = { Lexer, Token, TokenType, KEYWORDS };
