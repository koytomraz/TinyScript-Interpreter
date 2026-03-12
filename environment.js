/**
 * environment.js — Runtime Variable Scope
 *
 * An Environment is a symbol table for one lexical scope.
 * Scopes form a chain: each Environment holds an optional reference to
 * its parent, so variable lookups walk up the chain (lexical scoping).
 *
 *   globalEnv
 *     └─ functionEnv  (created per function call)
 *          └─ blockEnv  (created per if/while block)
 *
 * API
 * ───
 *  define(name, value)  – declare a new binding in this scope
 *  get(name)            – look up a binding (walks parent chain)
 *  set(name, value)     – update an existing binding (walks parent chain)
 *  extend()             – create a child scope whose parent is this
 */

'use strict';

class Environment {
  /**
   * @param {Environment|null} parent  The enclosing scope, or null for global.
   */
  constructor(parent = null) {
    this.vars = new Map();
    this.parent = parent;
  }

  /**
   * Declare a new variable in THIS scope.
   * If the name is already declared here it will be silently overwritten
   * (useful for the REPL and top-level redefinitions).
   */
  define(name, value) {
    this.vars.set(name, value);
  }

  /**
   * Look up a variable by name.
   * Walks up parent scopes until found; throws if not found anywhere.
   */
  get(name) {
    if (this.vars.has(name)) {
      return this.vars.get(name);
    }
    if (this.parent !== null) {
      return this.parent.get(name);
    }
    throw new ReferenceError(`[Runtime] Undefined variable: '${name}'`);
  }

  /**
   * Assign a new value to an existing variable.
   * Walks up parent scopes to find where the variable was declared.
   * Throws if the variable has never been declared.
   */
  set(name, value) {
    if (this.vars.has(name)) {
      this.vars.set(name, value);
      return;
    }
    if (this.parent !== null) {
      this.parent.set(name, value);
      return;
    }
    throw new ReferenceError(`[Runtime] Cannot assign to undeclared variable: '${name}'`);
  }

  /**
   * Create a new child scope with this environment as its parent.
   * Used for function calls, if-blocks, while-blocks, etc.
   */
  extend() {
    return new Environment(this);
  }
}

module.exports = { Environment };
