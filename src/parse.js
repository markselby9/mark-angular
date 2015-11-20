/**
 * Created by fengchaoyi on 15/11/18.
 */
'use strict';

var _ = require('lodash');

function parse(expr){
    var lexer = new Lexer();
    var parser = new Parser(lexer);
    var result = parser.parse(expr);
    console.log(result);
    return result;
}

function Lexer(){

}

Lexer.prototype.lex = function(text){
    //tokenization
    this.text = text;
    this.index = 0;
    this.ch = undefined;
    this.tokens = [];

    while (this.index < this.text.length){
        this.ch = this.text.charAt(this.index);
        if (this.isNumber(this.ch) || (this.is('.') && this.isNumber(this.peek()))){
            this.readNumber();
        }
        else if (this.ch === '\'' || this.ch === '"'){
            this.readString(this.ch);
        }
        else if (this.is('[],{}:')){
        //else if (this.ch === '[' || this.ch === ']' || this.ch === ','){
            this.tokens.push({
                text: this.ch
            });
            this.index++;
        }
        else if (this.isIdentifier(this.ch)){
            this.readIdentifier();
        } else if (this.isWhitespace(this.ch)){
            this.index++;
        }
        else{
            throw 'undexpected next character: '+this.ch;
        }
    }
    return this.tokens;
};

Lexer.prototype.isNumber = function(ch){
    return ch>='0' && ch<='9';
};

Lexer.prototype.isIdentifier = function(ch){
    return (ch>='a' && ch<='z') || (ch>='A' && ch<='Z') || (ch==='$') || (ch==='_');
};

Lexer.prototype.peek = function(){  //handle .42 case
    return this.index < this.text.length-1? this.text.charAt(this.index+1): false;
};

Lexer.prototype.is = function(chs){
    //checks whether the current character matches any character in that string
    return chs.indexOf(this.ch) >= 0;
};

Lexer.prototype.readNumber = function(){
    var number = '';
    while (this.index < this.text.length){
        var ch = this.text.charAt(this.index).toLowerCase();
        if (this.isNumber(ch) || ch === '.'){
            number += ch;
        } else{
            var nextCh = this.peek();
            var prevCh = number.charAt(number.length-1);
            if (ch==='e' && this.isExpOperator(nextCh)){
                number+=ch;
            }
            else if (this.isExpOperator(ch) && prevCh === 'e' && nextCh && this.isNumber(nextCh)){
                number+=ch;
            }
            else if (this.isExpOperator(ch) && prevCh === 'e' && (!nextCh || !this.isNumber(nextCh))){
                throw "invalid exponent";
            } else{
                break;  //ch not a number
            }
        }
        this.index++;
    }
    this.tokens.push({
        text: number,
        value: Number(number)
    });
};

var ESCAPES = {'n':'\n', 'f':'\f', 'r':'\r', 't':'\t', 'v': '\v', '\'':'\'', '"':'"'};

Lexer.prototype.readString = function(startCh){
    this.index++;
    var string = '';
    var escape = false;
    while (this.index < this.text.length){
        var ch = this.text.charAt(this.index);
        if (escape){
            //escape character
            if (ch==='u'){
                var hex = this.text.substring(this.index+1, this.index+5);
                if (!hex.match(/[\da-f]{4}/i)){
                    throw 'Invalid unicode escape';
                }
                this.index+=4;
                string+=String.fromCharCode(parseInt(hex, 16));
            }else{
                var replacement = ESCAPES[ch];
                if (replacement){
                    string += replacement;
                }else{
                    string+=ch;
                }
            }
            escape=false;
        }
        else if (ch===startCh){
            this.index++;
            this.tokens.push({
                text: string,
                value: string
            });
            return;
        }
        else if (ch === '\\'){
            escape = true;
        }
        else{
            string+=ch;
        }
        this.index++;
    }
    throw 'Unmatched quote';
};

Lexer.prototype.isExpOperator = function(ch){
    return ch==='-' || ch==='+' || this.isNumber(ch);
};

Lexer.prototype.isWhitespace = function(ch){
    return ch===' ' || ch==='\r' || ch==='\t' || ch==='\n' || ch==='\v' || ch==='\u00A0';
};

Lexer.prototype.readIdentifier = function(){
    var text = '';
    while (this.index < this.text.length){
        var ch = this.text.charAt(this.index);
        if (this.isIdentifier(ch) || this.isNumber(ch)){
            text+=ch;
        }else{
            break;
        }
        this.index++;
    }
    var token = {text:text, identifier:true};
    this.tokens.push(token);
};

function AST(lexer){
    this.lexer = lexer;
}
AST.Program = 'Program';
AST.Literal = 'Literal';
AST.prototype.constants = {
    'null': {type:AST.Literal, value:null},
    'true': {type:AST.Literal, value:true},
    'false': {type:AST.Literal, value:false}
};
AST.ArrayExpression = 'ArrayExpression';
AST.ObjectExpression = 'ObjectExpression';
AST.Property = 'Property';
AST.Identifier = 'Identifier';

AST.prototype.ast = function(text){
    this.tokens = this.lexer.lex(text);
    // AST building
    return this.program();
};

AST.prototype.program = function(){
    return {type: AST.Program, body: this.primary()};
};
AST.prototype.primary = function(){ //handle the case if there is \ symbol
    if (this.expect('[')){
        return this.arrayDeclaration();
    }
    if (this.expect('{')){
        return this.objectDeclaration();
    }
    if (this.constants.hasOwnProperty(this.tokens[0].text)){
        return this.constants[this.consume().text];
    }else{
        return this.constant();
    }
};

AST.prototype.constant = function(){
    return {type: AST.Literal, value:this.consume().value};
};

AST.prototype.identifier = function(){
    return {type: AST.Identifier, name:this.consume().text};
};

AST.prototype.expect = function(e){
    if (this.peek(e)){
        return this.tokens.shift();
    }
};

AST.prototype.arrayDeclaration = function(){
    var elements = [];
    if (!this.peek(']')){
        do {
            if (this.peek(']')){
                break;
            }
            elements.push(this.primary());
        } while (this.expect(','));
    }
    this.consume(']');
    return {type: AST.ArrayExpression, elements: elements};
};

AST.prototype.objectDeclaration = function(){
    var properties = [];
    if (!this.peek('}')){
        do{
            var property = {type: AST.Property};
            if (this.peek().identifier){
                property.key = this.identifier();
            }else{
                property.key = this.constant();
            }
            this.consume(':');
            property.value = this.primary();
            properties.push(property);
        } while (this.expect(','));
    }
    this.consume('}');
    return {type: AST.ObjectExpression, properties: properties};
};

AST.prototype.consume = function(e){
    var token = this.expect(e);
    if (!token){
        throw 'unexpected, expecting: '+e;
    }
    return token;
};

AST.prototype.peek = function(e){
    if (this.tokens.length > 0){
        var text = this.tokens[0].text;
        if (text==e || !e){
            return this.tokens[0];
        }
    }
};

function ASTCompiler(astbuilder){
    this.astBuilder = astbuilder;
}

ASTCompiler.prototype.compile = function(text){
    var ast = this.astBuilder.ast(text);
    this.state = {body:[]};
    this.recurse(ast);
    return new Function(this.state.body.join(''));      //basically a form of eval
};

ASTCompiler.prototype.recurse = function(ast){
    switch (ast.type){
        case AST.Program:
            this.state.body.push('return ',this.recurse(ast.body),';');
            break;
        case AST.Literal:
            return this.escape(ast.value);
        case AST.ArrayExpression:
            var elements = _.map(ast.elements, function(element){
                return this.recurse(element);
            }, this);
            return '['+elements.join(',')+']';
        case AST.ObjectExpression:
            var properties = _.map(ast.properties, function(property){
                var key = property.key.type === AST.Identifier? property.key.name: this.escape(property.key.value);
                var value = this.recurse(property.value);
                return key+':'+value;
            }, this);
            return '{'+properties.join(',')+'}';
    }
};

ASTCompiler.prototype.escape = function(value){
    if (_.isString(value)){
        return '\'' + value.replace(this.stringEscapeRegex, this.stringEscapeFn) + '\'';
    }
    else if (_.isNull(value)){
        return 'null';
    }
    else{
        return value;
    }
};

ASTCompiler.prototype.stringEscapeRegex = /[^ a-zA-Z0-9]/g;
ASTCompiler.prototype.stringEscapeFn = function(c){
    return '\\u'+('0000'+ c.charCodeAt(0).toString(16)).slice(-4);
    //get the numeric unicode value, and convert it into corresponding hexadecimal unicode escape sequence
};

function Parser(lexer){
    this.lexer = lexer;
    this.ast = new AST(this.lexer);
    this.astCompiler = new ASTCompiler(this.ast);
}

Parser.prototype.parse = function(text){
    return this.astCompiler.compile(text);
};

module.exports = parse;