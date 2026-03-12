/**
 * ast.js — Abstract Syntax Tree Node Factories
 *
 * Every node is a plain JavaScript object with a `type` string and
 * type-specific fields. Factory functions keep the rest of the codebase
 * free of object-literal noise and make it easy to add new node kinds.
 *
 * Node catalogue
 * ──────────────
 *  Program              – root of every parsed program
 *  VariableDeclaration  – let name = init
 *  AssignmentExpression – name = value  (existing variable)
 *  BinaryExpression     – left op right  (+, -, *, /, ==, !=, <, >, <=, >=)
 *  LogicalExpression    – left && right  |  left || right
 *  UnaryExpression      – op operand     (-x, !flag)
 *  Identifier           – variable reference
 *  NumericLiteral       – 42, 3.14
 *  BooleanLiteral       – true, false
 *  StringLiteral        – "hello"
 *  IfStatement          – if (cond) block [else block]
 *  WhileStatement       – while (cond) block
 *  FunctionDeclaration  – function name(params) block
 *  CallExpression       – callee(args)
 *  ReturnStatement      – return [value]
 *  BlockStatement       – { statements }
 *  ExpressionStatement  – expression used as a statement
 */

'use strict';

function Program(body) {
  return { type: 'Program', body };
}

/** let name = init */
function VariableDeclaration(name, init) {
  return { type: 'VariableDeclaration', name, init };
}

/** name = value  (re-assignment to an already-declared variable) */
function AssignmentExpression(name, value) {
  return { type: 'AssignmentExpression', name, value };
}

/** left op right  — arithmetic and comparison */
function BinaryExpression(operator, left, right) {
  return { type: 'BinaryExpression', operator, left, right };
}

/** left && right  |  left || right  — short-circuit logical */
function LogicalExpression(operator, left, right) {
  return { type: 'LogicalExpression', operator, left, right };
}

/** op operand  — prefix unary:  -x   !flag */
function UnaryExpression(operator, operand) {
  return { type: 'UnaryExpression', operator, operand };
}

/** Reference to a named variable */
function Identifier(name) {
  return { type: 'Identifier', name };
}

/** Integer or floating-point number literal */
function NumericLiteral(value) {
  return { type: 'NumericLiteral', value };
}

/** Boolean literal: true | false */
function BooleanLiteral(value) {
  return { type: 'BooleanLiteral', value };
}

/** String literal: "hello world" */
function StringLiteral(value) {
  return { type: 'StringLiteral', value };
}

/** if (condition) consequent [else alternate] */
function IfStatement(condition, consequent, alternate) {
  return { type: 'IfStatement', condition, consequent, alternate };
}

/** while (condition) body */
function WhileStatement(condition, body) {
  return { type: 'WhileStatement', condition, body };
}

/** function name(params) body */
function FunctionDeclaration(name, params, body) {
  return { type: 'FunctionDeclaration', name, params, body };
}

/** callee(args)  — callee is always a string name in this language */
function CallExpression(callee, args) {
  return { type: 'CallExpression', callee, args };
}

/** return [value] */
function ReturnStatement(value) {
  return { type: 'ReturnStatement', value };
}

/** { body }  — a list of statements delimited by braces */
function BlockStatement(body) {
  return { type: 'BlockStatement', body };
}

/** Wraps any expression used in statement position */
function ExpressionStatement(expression) {
  return { type: 'ExpressionStatement', expression };
}

module.exports = {
  Program,
  VariableDeclaration,
  AssignmentExpression,
  BinaryExpression,
  LogicalExpression,
  UnaryExpression,
  Identifier,
  NumericLiteral,
  BooleanLiteral,
  StringLiteral,
  IfStatement,
  WhileStatement,
  FunctionDeclaration,
  CallExpression,
  ReturnStatement,
  BlockStatement,
  ExpressionStatement,
};
