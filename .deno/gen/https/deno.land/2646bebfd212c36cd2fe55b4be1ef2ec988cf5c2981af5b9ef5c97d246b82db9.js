import { escapeForWithinString, getStringFromStrOrFunc } from "./utils/string_utils.ts";
var /** @internal */ CommentChar;
(function(CommentChar) {
    CommentChar[CommentChar["Line"] = 0] = "Line";
    CommentChar[CommentChar["Star"] = 1] = "Star";
})(CommentChar || (CommentChar = {}));
// Using the char codes is a performance improvement (about 5.5% faster when writing because it eliminates additional string allocations).
const CHARS = {
    BACK_SLASH: "\\".charCodeAt(0),
    FORWARD_SLASH: "/".charCodeAt(0),
    NEW_LINE: "\n".charCodeAt(0),
    CARRIAGE_RETURN: "\r".charCodeAt(0),
    ASTERISK: "*".charCodeAt(0),
    DOUBLE_QUOTE: "\"".charCodeAt(0),
    SINGLE_QUOTE: "'".charCodeAt(0),
    BACK_TICK: "`".charCodeAt(0),
    OPEN_BRACE: "{".charCodeAt(0),
    CLOSE_BRACE: "}".charCodeAt(0),
    DOLLAR_SIGN: "$".charCodeAt(0),
    SPACE: " ".charCodeAt(0),
    TAB: "\t".charCodeAt(0)
};
const isCharToHandle = new Set([
    CHARS.BACK_SLASH,
    CHARS.FORWARD_SLASH,
    CHARS.NEW_LINE,
    CHARS.CARRIAGE_RETURN,
    CHARS.ASTERISK,
    CHARS.DOUBLE_QUOTE,
    CHARS.SINGLE_QUOTE,
    CHARS.BACK_TICK,
    CHARS.OPEN_BRACE,
    CHARS.CLOSE_BRACE, 
]);
/**
 * Code writer that assists with formatting and visualizing blocks of JavaScript or TypeScript code.
 */ export default class CodeBlockWriter {
    /** @internal */ _indentationText;
    /** @internal */ _newLine;
    /** @internal */ _useTabs;
    /** @internal */ _quoteChar;
    /** @internal */ _indentNumberOfSpaces;
    /** @internal */ _currentIndentation = 0;
    /** @internal */ _queuedIndentation;
    /** @internal */ _queuedOnlyIfNotBlock;
    /** @internal */ _length = 0;
    /** @internal */ _newLineOnNextWrite = false;
    /** @internal */ _currentCommentChar = undefined;
    /** @internal */ _stringCharStack = [];
    /** @internal */ _isInRegEx = false;
    /** @internal */ _isOnFirstLineOfBlock = true;
    // An array of strings is used rather than a single string because it was
    // found to be ~11x faster when printing a 10K line file (~11s to ~1s).
    /** @internal */ _texts = [];
    /**
   * Constructor.
   * @param opts - Options for the writer.
   */ constructor(opts = {}){
        this._newLine = opts.newLine || "\n";
        this._useTabs = opts.useTabs || false;
        this._indentNumberOfSpaces = opts.indentNumberOfSpaces || 4;
        this._indentationText = getIndentationText(this._useTabs, this._indentNumberOfSpaces);
        this._quoteChar = opts.useSingleQuote ? "'" : `"`;
    }
    /**
   * Gets the options.
   */ getOptions() {
        return {
            indentNumberOfSpaces: this._indentNumberOfSpaces,
            newLine: this._newLine,
            useTabs: this._useTabs,
            useSingleQuote: this._quoteChar === "'"
        };
    }
    queueIndentationLevel(countOrText) {
        this._queuedIndentation = this._getIndentationLevelFromArg(countOrText);
        this._queuedOnlyIfNotBlock = undefined;
        return this;
    }
    /**
   * Writes the text within the provided action with hanging indentation.
   * @param action - Action to perform with hanging indentation.
   */ hangingIndent(action) {
        return this._withResetIndentation(()=>this.queueIndentationLevel(this.getIndentationLevel() + 1), action);
    }
    /**
   * Writes the text within the provided action with hanging indentation unless writing a block.
   * @param action - Action to perform with hanging indentation unless a block is written.
   */ hangingIndentUnlessBlock(action) {
        return this._withResetIndentation(()=>{
            this.queueIndentationLevel(this.getIndentationLevel() + 1);
            this._queuedOnlyIfNotBlock = true;
        }, action);
    }
    setIndentationLevel(countOrText) {
        this._currentIndentation = this._getIndentationLevelFromArg(countOrText);
        return this;
    }
    withIndentationLevel(countOrText, action) {
        return this._withResetIndentation(()=>this.setIndentationLevel(countOrText), action);
    }
    /** @internal */ _withResetIndentation(setStateAction, writeAction) {
        const previousState = this._getIndentationState();
        setStateAction();
        try {
            writeAction();
        } finally{
            this._setIndentationState(previousState);
        }
        return this;
    }
    /**
   * Gets the current indentation level.
   */ getIndentationLevel() {
        return this._currentIndentation;
    }
    /**
   * Writes a block using braces.
   * @param block - Write using the writer within this block.
   */ block(block) {
        this._newLineIfNewLineOnNextWrite();
        if (this.getLength() > 0 && !this.isLastNewLine()) {
            this.spaceIfLastNot();
        }
        this.inlineBlock(block);
        this._newLineOnNextWrite = true;
        return this;
    }
    /**
   * Writes an inline block with braces.
   * @param block - Write using the writer within this block.
   */ inlineBlock(block) {
        this._newLineIfNewLineOnNextWrite();
        this.write("{");
        this._indentBlockInternal(block);
        this.newLineIfLastNot().write("}");
        return this;
    }
    indent(timesOrBlock = 1) {
        if (typeof timesOrBlock === "number") {
            this._newLineIfNewLineOnNextWrite();
            return this.write(this._indentationText.repeat(timesOrBlock));
        } else {
            this._indentBlockInternal(timesOrBlock);
            if (!this.isLastNewLine()) {
                this._newLineOnNextWrite = true;
            }
            return this;
        }
    }
    /** @internal */ _indentBlockInternal(block) {
        if (this.getLastChar() != null) {
            this.newLineIfLastNot();
        }
        this._currentIndentation++;
        this._isOnFirstLineOfBlock = true;
        if (block != null) {
            block();
        }
        this._isOnFirstLineOfBlock = false;
        this._currentIndentation = Math.max(0, this._currentIndentation - 1);
    }
    conditionalWriteLine(condition, strOrFunc) {
        if (condition) {
            this.writeLine(getStringFromStrOrFunc(strOrFunc));
        }
        return this;
    }
    /**
   * Writes a line of text.
   * @param text - String to write.
   */ writeLine(text) {
        this._newLineIfNewLineOnNextWrite();
        if (this.getLastChar() != null) {
            this.newLineIfLastNot();
        }
        this._writeIndentingNewLines(text);
        this.newLine();
        return this;
    }
    /**
   * Writes a newline if the last line was not a newline.
   */ newLineIfLastNot() {
        this._newLineIfNewLineOnNextWrite();
        if (!this.isLastNewLine()) {
            this.newLine();
        }
        return this;
    }
    /**
   * Writes a blank line if the last written text was not a blank line.
   */ blankLineIfLastNot() {
        if (!this.isLastBlankLine()) {
            this.blankLine();
        }
        return this;
    }
    /**
   * Writes a blank line if the condition is true.
   * @param condition - Condition to evaluate.
   */ conditionalBlankLine(condition) {
        if (condition) {
            this.blankLine();
        }
        return this;
    }
    /**
   * Writes a blank line.
   */ blankLine() {
        return this.newLineIfLastNot().newLine();
    }
    /**
   * Writes a newline if the condition is true.
   * @param condition - Condition to evaluate.
   */ conditionalNewLine(condition) {
        if (condition) {
            this.newLine();
        }
        return this;
    }
    /**
   * Writes a newline.
   */ newLine() {
        this._newLineOnNextWrite = false;
        this._baseWriteNewline();
        return this;
    }
    quote(text) {
        this._newLineIfNewLineOnNextWrite();
        this._writeIndentingNewLines(text == null ? this._quoteChar : this._quoteChar + escapeForWithinString(text, this._quoteChar) + this._quoteChar);
        return this;
    }
    /**
   * Writes a space if the last character was not a space.
   */ spaceIfLastNot() {
        this._newLineIfNewLineOnNextWrite();
        if (!this.isLastSpace()) {
            this._writeIndentingNewLines(" ");
        }
        return this;
    }
    /**
   * Writes a space.
   * @param times - Number of times to write a space.
   */ space(times = 1) {
        this._newLineIfNewLineOnNextWrite();
        this._writeIndentingNewLines(" ".repeat(times));
        return this;
    }
    /**
   * Writes a tab if the last character was not a tab.
   */ tabIfLastNot() {
        this._newLineIfNewLineOnNextWrite();
        if (!this.isLastTab()) {
            this._writeIndentingNewLines("\t");
        }
        return this;
    }
    /**
   * Writes a tab.
   * @param times - Number of times to write a tab.
   */ tab(times = 1) {
        this._newLineIfNewLineOnNextWrite();
        this._writeIndentingNewLines("\t".repeat(times));
        return this;
    }
    conditionalWrite(condition, textOrFunc) {
        if (condition) {
            this.write(getStringFromStrOrFunc(textOrFunc));
        }
        return this;
    }
    /**
   * Writes the provided text.
   * @param text - Text to write.
   */ write(text) {
        this._newLineIfNewLineOnNextWrite();
        this._writeIndentingNewLines(text);
        return this;
    }
    /**
   * Writes text to exit a comment if in a comment.
   */ closeComment() {
        const commentChar = this._currentCommentChar;
        switch(commentChar){
            case CommentChar.Line:
                this.newLine();
                break;
            case CommentChar.Star:
                if (!this.isLastNewLine()) {
                    this.spaceIfLastNot();
                }
                this.write("*/");
                break;
            default:
                {
                    const _assertUndefined = commentChar;
                    break;
                }
        }
        return this;
    }
    /**
   * Inserts text at the provided position.
   *
   * This method is "unsafe" because it won't update the state of the writer unless
   * inserting at the end position. It is biased towards being fast at inserting closer
   * to the start or end, but slower to insert in the middle. Only use this if
   * absolutely necessary.
   * @param pos - Position to insert at.
   * @param text - Text to insert.
   */ unsafeInsert(pos, text) {
        const textLength = this._length;
        const texts = this._texts;
        verifyInput();
        if (pos === textLength) {
            return this.write(text);
        }
        updateInternalArray();
        this._length += text.length;
        return this;
        function verifyInput() {
            if (pos < 0) {
                throw new Error(`Provided position of '${pos}' was less than zero.`);
            }
            if (pos > textLength) {
                throw new Error(`Provided position of '${pos}' was greater than the text length of '${textLength}'.`);
            }
        }
        function updateInternalArray() {
            const { index , localIndex  } = getArrayIndexAndLocalIndex();
            if (localIndex === 0) {
                texts.splice(index, 0, text);
            } else if (localIndex === texts[index].length) {
                texts.splice(index + 1, 0, text);
            } else {
                const textItem = texts[index];
                const startText = textItem.substring(0, localIndex);
                const endText = textItem.substring(localIndex);
                texts.splice(index, 1, startText, text, endText);
            }
        }
        function getArrayIndexAndLocalIndex() {
            if (pos < textLength / 2) {
                // start searching from the front
                let endPos = 0;
                for(let i = 0; i < texts.length; i++){
                    const textItem = texts[i];
                    const startPos = endPos;
                    endPos += textItem.length;
                    if (endPos >= pos) {
                        return {
                            index: i,
                            localIndex: pos - startPos
                        };
                    }
                }
            } else {
                // start searching from the back
                let startPos1 = textLength;
                for(let i1 = texts.length - 1; i1 >= 0; i1--){
                    const textItem1 = texts[i1];
                    startPos1 -= textItem1.length;
                    if (startPos1 <= pos) {
                        return {
                            index: i1,
                            localIndex: pos - startPos1
                        };
                    }
                }
            }
            throw new Error("Unhandled situation inserting. This should never happen.");
        }
    }
    /**
   * Gets the length of the string in the writer.
   */ getLength() {
        return this._length;
    }
    /**
   * Gets if the writer is currently in a comment.
   */ isInComment() {
        return this._currentCommentChar !== undefined;
    }
    /**
   * Gets if the writer is currently at the start of the first line of the text, block, or indentation block.
   */ isAtStartOfFirstLineOfBlock() {
        return this.isOnFirstLineOfBlock() && (this.isLastNewLine() || this.getLastChar() == null);
    }
    /**
   * Gets if the writer is currently on the first line of the text, block, or indentation block.
   */ isOnFirstLineOfBlock() {
        return this._isOnFirstLineOfBlock;
    }
    /**
   * Gets if the writer is currently in a string.
   */ isInString() {
        return this._stringCharStack.length > 0 && this._stringCharStack[this._stringCharStack.length - 1] !== CHARS.OPEN_BRACE;
    }
    /**
   * Gets if the last chars written were for a newline.
   */ isLastNewLine() {
        const lastChar = this.getLastChar();
        return lastChar === "\n" || lastChar === "\r";
    }
    /**
   * Gets if the last chars written were for a blank line.
   */ isLastBlankLine() {
        let foundCount = 0;
        // todo: consider extracting out iterating over past characters, but don't use
        // an iterator because it will be slow.
        for(let i = this._texts.length - 1; i >= 0; i--){
            const currentText = this._texts[i];
            for(let j = currentText.length - 1; j >= 0; j--){
                const currentChar = currentText.charCodeAt(j);
                if (currentChar === CHARS.NEW_LINE) {
                    foundCount++;
                    if (foundCount === 2) {
                        return true;
                    }
                } else if (currentChar !== CHARS.CARRIAGE_RETURN) {
                    return false;
                }
            }
        }
        return false;
    }
    /**
   * Gets if the last char written was a space.
   */ isLastSpace() {
        return this.getLastChar() === " ";
    }
    /**
   * Gets if the last char written was a tab.
   */ isLastTab() {
        return this.getLastChar() === "\t";
    }
    /**
   * Gets the last char written.
   */ getLastChar() {
        const charCode = this._getLastCharCodeWithOffset(0);
        return charCode == null ? undefined : String.fromCharCode(charCode);
    }
    /**
   * Gets if the writer ends with the provided text.
   * @param text - Text to check if the writer ends with the provided text.
   */ endsWith(text) {
        const length = this._length;
        return this.iterateLastCharCodes((charCode, index)=>{
            const offset = length - index;
            const textIndex = text.length - offset;
            if (text.charCodeAt(textIndex) !== charCode) {
                return false;
            }
            return textIndex === 0 ? true : undefined;
        }) || false;
    }
    /**
   * Iterates over the writer characters in reverse order. The iteration stops when a non-null or
   * undefined value is returned from the action. The returned value is then returned by the method.
   *
   * @remarks It is much more efficient to use this method rather than `#toString()` since `#toString()`
   * will combine the internal array into a string.
   */ iterateLastChars(action) {
        return this.iterateLastCharCodes((charCode, index)=>action(String.fromCharCode(charCode), index));
    }
    /**
   * Iterates over the writer character char codes in reverse order. The iteration stops when a non-null or
   * undefined value is returned from the action. The returned value is then returned by the method.
   *
   * @remarks It is much more efficient to use this method rather than `#toString()` since `#toString()`
   * will combine the internal array into a string. Additionally, this is slightly more efficient that
   * `iterateLastChars` as this won't allocate a string per character.
   */ iterateLastCharCodes(action) {
        let index = this._length;
        for(let i = this._texts.length - 1; i >= 0; i--){
            const currentText = this._texts[i];
            for(let j = currentText.length - 1; j >= 0; j--){
                index--;
                const result = action(currentText.charCodeAt(j), index);
                if (result != null) {
                    return result;
                }
            }
        }
        return undefined;
    }
    /**
   * Gets the writer's text.
   */ toString() {
        if (this._texts.length > 1) {
            const text = this._texts.join("");
            this._texts.length = 0;
            this._texts.push(text);
        }
        return this._texts[0] || "";
    }
    /** @internal */ static _newLineRegEx = /\r?\n/;
    /** @internal */ _writeIndentingNewLines(text) {
        text = text || "";
        if (text.length === 0) {
            writeIndividual(this, "");
            return;
        }
        const items = text.split(CodeBlockWriter._newLineRegEx);
        items.forEach((s, i)=>{
            if (i > 0) {
                this._baseWriteNewline();
            }
            if (s.length === 0) {
                return;
            }
            writeIndividual(this, s);
        });
        function writeIndividual(writer, s) {
            if (!writer.isInString()) {
                const isAtStartOfLine = writer.isLastNewLine() || writer.getLastChar() == null;
                if (isAtStartOfLine) {
                    writer._writeIndentation();
                }
            }
            writer._updateInternalState(s);
            writer._internalWrite(s);
        }
    }
    /** @internal */ _baseWriteNewline() {
        if (this._currentCommentChar === CommentChar.Line) {
            this._currentCommentChar = undefined;
        }
        const lastStringCharOnStack = this._stringCharStack[this._stringCharStack.length - 1];
        if ((lastStringCharOnStack === CHARS.DOUBLE_QUOTE || lastStringCharOnStack === CHARS.SINGLE_QUOTE) && this._getLastCharCodeWithOffset(0) !== CHARS.BACK_SLASH) {
            this._stringCharStack.pop();
        }
        this._internalWrite(this._newLine);
        this._isOnFirstLineOfBlock = false;
        this._dequeueQueuedIndentation();
    }
    /** @internal */ _dequeueQueuedIndentation() {
        if (this._queuedIndentation == null) {
            return;
        }
        if (this._queuedOnlyIfNotBlock && wasLastBlock(this)) {
            this._queuedIndentation = undefined;
            this._queuedOnlyIfNotBlock = undefined;
        } else {
            this._currentIndentation = this._queuedIndentation;
            this._queuedIndentation = undefined;
        }
        function wasLastBlock(writer) {
            let foundNewLine = false;
            return writer.iterateLastCharCodes((charCode)=>{
                switch(charCode){
                    case CHARS.NEW_LINE:
                        if (foundNewLine) {
                            return false;
                        } else {
                            foundNewLine = true;
                        }
                        break;
                    case CHARS.CARRIAGE_RETURN:
                        return undefined;
                    case CHARS.OPEN_BRACE:
                        return true;
                    default:
                        return false;
                }
            });
        }
    }
    /** @internal */ _updateInternalState(str) {
        for(let i = 0; i < str.length; i++){
            const currentChar = str.charCodeAt(i);
            // This is a performance optimization to short circuit all the checks below. If the current char
            // is not in this set then it won't change any internal state so no need to continue and do
            // so many other checks (this made it 3x faster in one scenario I tested).
            if (!isCharToHandle.has(currentChar)) {
                continue;
            }
            const pastChar = i === 0 ? this._getLastCharCodeWithOffset(0) : str.charCodeAt(i - 1);
            const pastPastChar = i === 0 ? this._getLastCharCodeWithOffset(1) : i === 1 ? this._getLastCharCodeWithOffset(0) : str.charCodeAt(i - 2);
            // handle regex
            if (this._isInRegEx) {
                if (pastChar === CHARS.FORWARD_SLASH && pastPastChar !== CHARS.BACK_SLASH || pastChar === CHARS.NEW_LINE) {
                    this._isInRegEx = false;
                } else {
                    continue;
                }
            } else if (!this.isInString() && !this.isInComment() && isRegExStart(currentChar, pastChar, pastPastChar)) {
                this._isInRegEx = true;
                continue;
            }
            // handle comments
            if (this._currentCommentChar == null && pastChar === CHARS.FORWARD_SLASH && currentChar === CHARS.FORWARD_SLASH) {
                this._currentCommentChar = CommentChar.Line;
            } else if (this._currentCommentChar == null && pastChar === CHARS.FORWARD_SLASH && currentChar === CHARS.ASTERISK) {
                this._currentCommentChar = CommentChar.Star;
            } else if (this._currentCommentChar === CommentChar.Star && pastChar === CHARS.ASTERISK && currentChar === CHARS.FORWARD_SLASH) {
                this._currentCommentChar = undefined;
            }
            if (this.isInComment()) {
                continue;
            }
            // handle strings
            const lastStringCharOnStack = this._stringCharStack.length === 0 ? undefined : this._stringCharStack[this._stringCharStack.length - 1];
            if (pastChar !== CHARS.BACK_SLASH && (currentChar === CHARS.DOUBLE_QUOTE || currentChar === CHARS.SINGLE_QUOTE || currentChar === CHARS.BACK_TICK)) {
                if (lastStringCharOnStack === currentChar) {
                    this._stringCharStack.pop();
                } else if (lastStringCharOnStack === CHARS.OPEN_BRACE || lastStringCharOnStack === undefined) {
                    this._stringCharStack.push(currentChar);
                }
            } else if (pastPastChar !== CHARS.BACK_SLASH && pastChar === CHARS.DOLLAR_SIGN && currentChar === CHARS.OPEN_BRACE && lastStringCharOnStack === CHARS.BACK_TICK) {
                this._stringCharStack.push(currentChar);
            } else if (currentChar === CHARS.CLOSE_BRACE && lastStringCharOnStack === CHARS.OPEN_BRACE) {
                this._stringCharStack.pop();
            }
        }
    }
    /** @internal - This is private, but exposed for testing. */ _getLastCharCodeWithOffset(offset) {
        if (offset >= this._length || offset < 0) {
            return undefined;
        }
        for(let i = this._texts.length - 1; i >= 0; i--){
            const currentText = this._texts[i];
            if (offset >= currentText.length) {
                offset -= currentText.length;
            } else {
                return currentText.charCodeAt(currentText.length - 1 - offset);
            }
        }
        return undefined;
    }
    /** @internal */ _writeIndentation() {
        const flooredIndentation = Math.floor(this._currentIndentation);
        this._internalWrite(this._indentationText.repeat(flooredIndentation));
        const overflow = this._currentIndentation - flooredIndentation;
        if (this._useTabs) {
            if (overflow > 0.5) {
                this._internalWrite(this._indentationText);
            }
        } else {
            const portion = Math.round(this._indentationText.length * overflow);
            // build up the string first, then append it for performance reasons
            let text = "";
            for(let i = 0; i < portion; i++){
                text += this._indentationText[i];
            }
            this._internalWrite(text);
        }
    }
    /** @internal */ _newLineIfNewLineOnNextWrite() {
        if (!this._newLineOnNextWrite) {
            return;
        }
        this._newLineOnNextWrite = false;
        this.newLine();
    }
    /** @internal */ _internalWrite(text) {
        if (text.length === 0) {
            return;
        }
        this._texts.push(text);
        this._length += text.length;
    }
    /** @internal */ static _spacesOrTabsRegEx = /^[ \t]*$/;
    /** @internal */ _getIndentationLevelFromArg(countOrText) {
        if (typeof countOrText === "number") {
            if (countOrText < 0) {
                throw new Error("Passed in indentation level should be greater than or equal to 0.");
            }
            return countOrText;
        } else if (typeof countOrText === "string") {
            if (!CodeBlockWriter._spacesOrTabsRegEx.test(countOrText)) {
                throw new Error("Provided string must be empty or only contain spaces or tabs.");
            }
            const { spacesCount , tabsCount  } = getSpacesAndTabsCount(countOrText);
            return tabsCount + spacesCount / this._indentNumberOfSpaces;
        } else {
            throw new Error("Argument provided must be a string or number.");
        }
    }
    /** @internal */ _setIndentationState(state) {
        this._currentIndentation = state.current;
        this._queuedIndentation = state.queued;
        this._queuedOnlyIfNotBlock = state.queuedOnlyIfNotBlock;
    }
    /** @internal */ _getIndentationState() {
        return {
            current: this._currentIndentation,
            queued: this._queuedIndentation,
            queuedOnlyIfNotBlock: this._queuedOnlyIfNotBlock
        };
    }
};
function isRegExStart(currentChar, pastChar, pastPastChar) {
    return pastChar === CHARS.FORWARD_SLASH && currentChar !== CHARS.FORWARD_SLASH && currentChar !== CHARS.ASTERISK && pastPastChar !== CHARS.ASTERISK && pastPastChar !== CHARS.FORWARD_SLASH;
}
function getIndentationText(useTabs, numberSpaces) {
    if (useTabs) {
        return "\t";
    }
    return Array(numberSpaces + 1).join(" ");
}
function getSpacesAndTabsCount(str) {
    let spacesCount = 0;
    let tabsCount = 0;
    for(let i = 0; i < str.length; i++){
        const charCode = str.charCodeAt(i);
        if (charCode === CHARS.SPACE) {
            spacesCount++;
        } else if (charCode === CHARS.TAB) {
            tabsCount++;
        }
    }
    return {
        spacesCount,
        tabsCount
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvY29kZV9ibG9ja193cml0ZXJAMTEuMC4zL21vZC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBlc2NhcGVGb3JXaXRoaW5TdHJpbmcsIGdldFN0cmluZ0Zyb21TdHJPckZ1bmMgfSBmcm9tIFwiLi91dGlscy9zdHJpbmdfdXRpbHMudHNcIjtcblxuLyoqIEBpbnRlcm5hbCAqL1xuZW51bSBDb21tZW50Q2hhciB7XG4gIExpbmUsXG4gIFN0YXIsXG59XG5cbi8qKlxuICogT3B0aW9ucyBmb3IgdGhlIHdyaXRlci5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBPcHRpb25zIHtcbiAgLyoqXG4gICAqIE5ld2xpbmUgY2hhcmFjdGVyLlxuICAgKiBAcmVtYXJrcyBEZWZhdWx0cyB0byBcXG4uXG4gICAqL1xuICBuZXdMaW5lOiBcIlxcblwiIHwgXCJcXHJcXG5cIjtcbiAgLyoqXG4gICAqIE51bWJlciBvZiBzcGFjZXMgdG8gaW5kZW50IHdoZW4gYHVzZVRhYnNgIGlzIGZhbHNlLlxuICAgKiBAcmVtYXJrcyBEZWZhdWx0cyB0byA0LlxuICAgKi9cbiAgaW5kZW50TnVtYmVyT2ZTcGFjZXM6IG51bWJlcjtcbiAgLyoqXG4gICAqIFdoZXRoZXIgdG8gdXNlIHRhYnMgKHRydWUpIG9yIHNwYWNlcyAoZmFsc2UpLlxuICAgKiBAcmVtYXJrcyBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICovXG4gIHVzZVRhYnM6IGJvb2xlYW47XG4gIC8qKlxuICAgKiBXaGV0aGVyIHRvIHVzZSBhIHNpbmdsZSBxdW90ZSAodHJ1ZSkgb3IgZG91YmxlIHF1b3RlIChmYWxzZSkuXG4gICAqIEByZW1hcmtzIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgKi9cbiAgdXNlU2luZ2xlUXVvdGU6IGJvb2xlYW47XG59XG5cbi8vIFVzaW5nIHRoZSBjaGFyIGNvZGVzIGlzIGEgcGVyZm9ybWFuY2UgaW1wcm92ZW1lbnQgKGFib3V0IDUuNSUgZmFzdGVyIHdoZW4gd3JpdGluZyBiZWNhdXNlIGl0IGVsaW1pbmF0ZXMgYWRkaXRpb25hbCBzdHJpbmcgYWxsb2NhdGlvbnMpLlxuY29uc3QgQ0hBUlMgPSB7XG4gIEJBQ0tfU0xBU0g6IFwiXFxcXFwiLmNoYXJDb2RlQXQoMCksXG4gIEZPUldBUkRfU0xBU0g6IFwiL1wiLmNoYXJDb2RlQXQoMCksXG4gIE5FV19MSU5FOiBcIlxcblwiLmNoYXJDb2RlQXQoMCksXG4gIENBUlJJQUdFX1JFVFVSTjogXCJcXHJcIi5jaGFyQ29kZUF0KDApLFxuICBBU1RFUklTSzogXCIqXCIuY2hhckNvZGVBdCgwKSxcbiAgRE9VQkxFX1FVT1RFOiBcIlxcXCJcIi5jaGFyQ29kZUF0KDApLFxuICBTSU5HTEVfUVVPVEU6IFwiJ1wiLmNoYXJDb2RlQXQoMCksXG4gIEJBQ0tfVElDSzogXCJgXCIuY2hhckNvZGVBdCgwKSxcbiAgT1BFTl9CUkFDRTogXCJ7XCIuY2hhckNvZGVBdCgwKSxcbiAgQ0xPU0VfQlJBQ0U6IFwifVwiLmNoYXJDb2RlQXQoMCksXG4gIERPTExBUl9TSUdOOiBcIiRcIi5jaGFyQ29kZUF0KDApLFxuICBTUEFDRTogXCIgXCIuY2hhckNvZGVBdCgwKSxcbiAgVEFCOiBcIlxcdFwiLmNoYXJDb2RlQXQoMCksXG59O1xuY29uc3QgaXNDaGFyVG9IYW5kbGUgPSBuZXcgU2V0PG51bWJlcj4oW1xuICBDSEFSUy5CQUNLX1NMQVNILFxuICBDSEFSUy5GT1JXQVJEX1NMQVNILFxuICBDSEFSUy5ORVdfTElORSxcbiAgQ0hBUlMuQ0FSUklBR0VfUkVUVVJOLFxuICBDSEFSUy5BU1RFUklTSyxcbiAgQ0hBUlMuRE9VQkxFX1FVT1RFLFxuICBDSEFSUy5TSU5HTEVfUVVPVEUsXG4gIENIQVJTLkJBQ0tfVElDSyxcbiAgQ0hBUlMuT1BFTl9CUkFDRSxcbiAgQ0hBUlMuQ0xPU0VfQlJBQ0UsXG5dKTtcblxuLyoqXG4gKiBDb2RlIHdyaXRlciB0aGF0IGFzc2lzdHMgd2l0aCBmb3JtYXR0aW5nIGFuZCB2aXN1YWxpemluZyBibG9ja3Mgb2YgSmF2YVNjcmlwdCBvciBUeXBlU2NyaXB0IGNvZGUuXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIENvZGVCbG9ja1dyaXRlciB7XG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgcHJpdmF0ZSByZWFkb25seSBfaW5kZW50YXRpb25UZXh0OiBzdHJpbmc7XG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgcHJpdmF0ZSByZWFkb25seSBfbmV3TGluZTogXCJcXG5cIiB8IFwiXFxyXFxuXCI7XG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgcHJpdmF0ZSByZWFkb25seSBfdXNlVGFiczogYm9vbGVhbjtcbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBwcml2YXRlIHJlYWRvbmx5IF9xdW90ZUNoYXI6IHN0cmluZztcbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBwcml2YXRlIHJlYWRvbmx5IF9pbmRlbnROdW1iZXJPZlNwYWNlczogbnVtYmVyO1xuICAvKiogQGludGVybmFsICovXG4gIHByaXZhdGUgX2N1cnJlbnRJbmRlbnRhdGlvbiA9IDA7XG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgcHJpdmF0ZSBfcXVldWVkSW5kZW50YXRpb246IG51bWJlciB8IHVuZGVmaW5lZDtcbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBwcml2YXRlIF9xdWV1ZWRPbmx5SWZOb3RCbG9jazogdHJ1ZSB8IHVuZGVmaW5lZDtcbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBwcml2YXRlIF9sZW5ndGggPSAwO1xuICAvKiogQGludGVybmFsICovXG4gIHByaXZhdGUgX25ld0xpbmVPbk5leHRXcml0ZSA9IGZhbHNlO1xuICAvKiogQGludGVybmFsICovXG4gIHByaXZhdGUgX2N1cnJlbnRDb21tZW50Q2hhcjogQ29tbWVudENoYXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgcHJpdmF0ZSBfc3RyaW5nQ2hhclN0YWNrOiBudW1iZXJbXSA9IFtdO1xuICAvKiogQGludGVybmFsICovXG4gIHByaXZhdGUgX2lzSW5SZWdFeCA9IGZhbHNlO1xuICAvKiogQGludGVybmFsICovXG4gIHByaXZhdGUgX2lzT25GaXJzdExpbmVPZkJsb2NrID0gdHJ1ZTtcbiAgLy8gQW4gYXJyYXkgb2Ygc3RyaW5ncyBpcyB1c2VkIHJhdGhlciB0aGFuIGEgc2luZ2xlIHN0cmluZyBiZWNhdXNlIGl0IHdhc1xuICAvLyBmb3VuZCB0byBiZSB+MTF4IGZhc3RlciB3aGVuIHByaW50aW5nIGEgMTBLIGxpbmUgZmlsZSAofjExcyB0byB+MXMpLlxuICAvKiogQGludGVybmFsICovXG4gIHByaXZhdGUgX3RleHRzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIC8qKlxuICAgKiBDb25zdHJ1Y3Rvci5cbiAgICogQHBhcmFtIG9wdHMgLSBPcHRpb25zIGZvciB0aGUgd3JpdGVyLlxuICAgKi9cbiAgY29uc3RydWN0b3Iob3B0czogUGFydGlhbDxPcHRpb25zPiA9IHt9KSB7XG4gICAgdGhpcy5fbmV3TGluZSA9IG9wdHMubmV3TGluZSB8fCBcIlxcblwiO1xuICAgIHRoaXMuX3VzZVRhYnMgPSBvcHRzLnVzZVRhYnMgfHwgZmFsc2U7XG4gICAgdGhpcy5faW5kZW50TnVtYmVyT2ZTcGFjZXMgPSBvcHRzLmluZGVudE51bWJlck9mU3BhY2VzIHx8IDQ7XG4gICAgdGhpcy5faW5kZW50YXRpb25UZXh0ID0gZ2V0SW5kZW50YXRpb25UZXh0KHRoaXMuX3VzZVRhYnMsIHRoaXMuX2luZGVudE51bWJlck9mU3BhY2VzKTtcbiAgICB0aGlzLl9xdW90ZUNoYXIgPSBvcHRzLnVzZVNpbmdsZVF1b3RlID8gXCInXCIgOiBgXCJgO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgdGhlIG9wdGlvbnMuXG4gICAqL1xuICBnZXRPcHRpb25zKCk6IE9wdGlvbnMge1xuICAgIHJldHVybiB7XG4gICAgICBpbmRlbnROdW1iZXJPZlNwYWNlczogdGhpcy5faW5kZW50TnVtYmVyT2ZTcGFjZXMsXG4gICAgICBuZXdMaW5lOiB0aGlzLl9uZXdMaW5lLFxuICAgICAgdXNlVGFiczogdGhpcy5fdXNlVGFicyxcbiAgICAgIHVzZVNpbmdsZVF1b3RlOiB0aGlzLl9xdW90ZUNoYXIgPT09IFwiJ1wiLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogUXVldWVzIHRoZSBpbmRlbnRhdGlvbiBsZXZlbCBmb3IgdGhlIG5leHQgbGluZXMgd3JpdHRlbi5cbiAgICogQHBhcmFtIGluZGVudGF0aW9uTGV2ZWwgLSBJbmRlbnRhdGlvbiBsZXZlbCB0byBxdWV1ZS5cbiAgICovXG4gIHF1ZXVlSW5kZW50YXRpb25MZXZlbChpbmRlbnRhdGlvbkxldmVsOiBudW1iZXIpOiB0aGlzO1xuICAvKipcbiAgICogUXVldWVzIHRoZSBpbmRlbnRhdGlvbiBsZXZlbCBmb3IgdGhlIG5leHQgbGluZXMgd3JpdHRlbiB1c2luZyB0aGUgcHJvdmlkZWQgaW5kZW50YXRpb24gdGV4dC5cbiAgICogQHBhcmFtIHdoaXRlc3BhY2VUZXh0IC0gR2V0cyB0aGUgaW5kZW50YXRpb24gbGV2ZWwgZnJvbSB0aGUgaW5kZW50YXRpb24gdGV4dC5cbiAgICovXG4gIHF1ZXVlSW5kZW50YXRpb25MZXZlbCh3aGl0ZXNwYWNlVGV4dDogc3RyaW5nKTogdGhpcztcbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBxdWV1ZUluZGVudGF0aW9uTGV2ZWwoY291bnRPclRleHQ6IHN0cmluZyB8IG51bWJlcik6IHRoaXM7XG4gIHF1ZXVlSW5kZW50YXRpb25MZXZlbChjb3VudE9yVGV4dDogc3RyaW5nIHwgbnVtYmVyKSB7XG4gICAgdGhpcy5fcXVldWVkSW5kZW50YXRpb24gPSB0aGlzLl9nZXRJbmRlbnRhdGlvbkxldmVsRnJvbUFyZyhjb3VudE9yVGV4dCk7XG4gICAgdGhpcy5fcXVldWVkT25seUlmTm90QmxvY2sgPSB1bmRlZmluZWQ7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogV3JpdGVzIHRoZSB0ZXh0IHdpdGhpbiB0aGUgcHJvdmlkZWQgYWN0aW9uIHdpdGggaGFuZ2luZyBpbmRlbnRhdGlvbi5cbiAgICogQHBhcmFtIGFjdGlvbiAtIEFjdGlvbiB0byBwZXJmb3JtIHdpdGggaGFuZ2luZyBpbmRlbnRhdGlvbi5cbiAgICovXG4gIGhhbmdpbmdJbmRlbnQoYWN0aW9uOiAoKSA9PiB2b2lkKTogdGhpcyB7XG4gICAgcmV0dXJuIHRoaXMuX3dpdGhSZXNldEluZGVudGF0aW9uKCgpID0+IHRoaXMucXVldWVJbmRlbnRhdGlvbkxldmVsKHRoaXMuZ2V0SW5kZW50YXRpb25MZXZlbCgpICsgMSksIGFjdGlvbik7XG4gIH1cblxuICAvKipcbiAgICogV3JpdGVzIHRoZSB0ZXh0IHdpdGhpbiB0aGUgcHJvdmlkZWQgYWN0aW9uIHdpdGggaGFuZ2luZyBpbmRlbnRhdGlvbiB1bmxlc3Mgd3JpdGluZyBhIGJsb2NrLlxuICAgKiBAcGFyYW0gYWN0aW9uIC0gQWN0aW9uIHRvIHBlcmZvcm0gd2l0aCBoYW5naW5nIGluZGVudGF0aW9uIHVubGVzcyBhIGJsb2NrIGlzIHdyaXR0ZW4uXG4gICAqL1xuICBoYW5naW5nSW5kZW50VW5sZXNzQmxvY2soYWN0aW9uOiAoKSA9PiB2b2lkKTogdGhpcyB7XG4gICAgcmV0dXJuIHRoaXMuX3dpdGhSZXNldEluZGVudGF0aW9uKCgpID0+IHtcbiAgICAgIHRoaXMucXVldWVJbmRlbnRhdGlvbkxldmVsKHRoaXMuZ2V0SW5kZW50YXRpb25MZXZlbCgpICsgMSk7XG4gICAgICB0aGlzLl9xdWV1ZWRPbmx5SWZOb3RCbG9jayA9IHRydWU7XG4gICAgfSwgYWN0aW9uKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBjdXJyZW50IGluZGVudGF0aW9uIGxldmVsLlxuICAgKiBAcGFyYW0gaW5kZW50YXRpb25MZXZlbCAtIEluZGVudGF0aW9uIGxldmVsIHRvIGJlIGF0LlxuICAgKi9cbiAgc2V0SW5kZW50YXRpb25MZXZlbChpbmRlbnRhdGlvbkxldmVsOiBudW1iZXIpOiB0aGlzO1xuICAvKipcbiAgICogU2V0cyB0aGUgY3VycmVudCBpbmRlbnRhdGlvbiB1c2luZyB0aGUgcHJvdmlkZWQgaW5kZW50YXRpb24gdGV4dC5cbiAgICogQHBhcmFtIHdoaXRlc3BhY2VUZXh0IC0gR2V0cyB0aGUgaW5kZW50YXRpb24gbGV2ZWwgZnJvbSB0aGUgaW5kZW50YXRpb24gdGV4dC5cbiAgICovXG4gIHNldEluZGVudGF0aW9uTGV2ZWwod2hpdGVzcGFjZVRleHQ6IHN0cmluZyk6IHRoaXM7XG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgc2V0SW5kZW50YXRpb25MZXZlbChjb3VudE9yVGV4dDogc3RyaW5nIHwgbnVtYmVyKTogdGhpcztcbiAgc2V0SW5kZW50YXRpb25MZXZlbChjb3VudE9yVGV4dDogc3RyaW5nIHwgbnVtYmVyKSB7XG4gICAgdGhpcy5fY3VycmVudEluZGVudGF0aW9uID0gdGhpcy5fZ2V0SW5kZW50YXRpb25MZXZlbEZyb21BcmcoY291bnRPclRleHQpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIGluZGVudGF0aW9uIGxldmVsIHdpdGhpbiB0aGUgcHJvdmlkZWQgYWN0aW9uIGFuZCByZXN0b3JlcyB0aGUgd3JpdGVyJ3MgaW5kZW50YXRpb25cbiAgICogc3RhdGUgYWZ0ZXJ3YXJkcy5cbiAgICogQHJlbWFya3MgUmVzdG9yZXMgdGhlIHdyaXRlcidzIHN0YXRlIGFmdGVyIHRoZSBhY3Rpb24uXG4gICAqIEBwYXJhbSBpbmRlbnRhdGlvbkxldmVsIC0gSW5kZW50YXRpb24gbGV2ZWwgdG8gc2V0LlxuICAgKiBAcGFyYW0gYWN0aW9uIC0gQWN0aW9uIHRvIHBlcmZvcm0gd2l0aCB0aGUgaW5kZW50YXRpb24uXG4gICAqL1xuICB3aXRoSW5kZW50YXRpb25MZXZlbChpbmRlbnRhdGlvbkxldmVsOiBudW1iZXIsIGFjdGlvbjogKCkgPT4gdm9pZCk6IHRoaXM7XG4gIC8qKlxuICAgKiBTZXRzIHRoZSBpbmRlbnRhdGlvbiBsZXZlbCB3aXRoIHRoZSBwcm92aWRlZCBpbmRlbnRhdGlvbiB0ZXh0IHdpdGhpbiB0aGUgcHJvdmlkZWQgYWN0aW9uXG4gICAqIGFuZCByZXN0b3JlcyB0aGUgd3JpdGVyJ3MgaW5kZW50YXRpb24gc3RhdGUgYWZ0ZXJ3YXJkcy5cbiAgICogQHBhcmFtIHdoaXRlc3BhY2VUZXh0IC0gR2V0cyB0aGUgaW5kZW50YXRpb24gbGV2ZWwgZnJvbSB0aGUgaW5kZW50YXRpb24gdGV4dC5cbiAgICogQHBhcmFtIGFjdGlvbiAtIEFjdGlvbiB0byBwZXJmb3JtIHdpdGggdGhlIGluZGVudGF0aW9uLlxuICAgKi9cbiAgd2l0aEluZGVudGF0aW9uTGV2ZWwod2hpdGVzcGFjZVRleHQ6IHN0cmluZywgYWN0aW9uOiAoKSA9PiB2b2lkKTogdGhpcztcbiAgd2l0aEluZGVudGF0aW9uTGV2ZWwoY291bnRPclRleHQ6IHN0cmluZyB8IG51bWJlciwgYWN0aW9uOiAoKSA9PiB2b2lkKSB7XG4gICAgcmV0dXJuIHRoaXMuX3dpdGhSZXNldEluZGVudGF0aW9uKCgpID0+IHRoaXMuc2V0SW5kZW50YXRpb25MZXZlbChjb3VudE9yVGV4dCksIGFjdGlvbik7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIHByaXZhdGUgX3dpdGhSZXNldEluZGVudGF0aW9uKHNldFN0YXRlQWN0aW9uOiAoKSA9PiB2b2lkLCB3cml0ZUFjdGlvbjogKCkgPT4gdm9pZCkge1xuICAgIGNvbnN0IHByZXZpb3VzU3RhdGUgPSB0aGlzLl9nZXRJbmRlbnRhdGlvblN0YXRlKCk7XG4gICAgc2V0U3RhdGVBY3Rpb24oKTtcbiAgICB0cnkge1xuICAgICAgd3JpdGVBY3Rpb24oKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgdGhpcy5fc2V0SW5kZW50YXRpb25TdGF0ZShwcmV2aW91c1N0YXRlKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogR2V0cyB0aGUgY3VycmVudCBpbmRlbnRhdGlvbiBsZXZlbC5cbiAgICovXG4gIGdldEluZGVudGF0aW9uTGV2ZWwoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5fY3VycmVudEluZGVudGF0aW9uO1xuICB9XG5cbiAgLyoqXG4gICAqIFdyaXRlcyBhIGJsb2NrIHVzaW5nIGJyYWNlcy5cbiAgICogQHBhcmFtIGJsb2NrIC0gV3JpdGUgdXNpbmcgdGhlIHdyaXRlciB3aXRoaW4gdGhpcyBibG9jay5cbiAgICovXG4gIGJsb2NrKGJsb2NrPzogKCkgPT4gdm9pZCk6IHRoaXMge1xuICAgIHRoaXMuX25ld0xpbmVJZk5ld0xpbmVPbk5leHRXcml0ZSgpO1xuICAgIGlmICh0aGlzLmdldExlbmd0aCgpID4gMCAmJiAhdGhpcy5pc0xhc3ROZXdMaW5lKCkpIHtcbiAgICAgIHRoaXMuc3BhY2VJZkxhc3ROb3QoKTtcbiAgICB9XG4gICAgdGhpcy5pbmxpbmVCbG9jayhibG9jayk7XG4gICAgdGhpcy5fbmV3TGluZU9uTmV4dFdyaXRlID0gdHJ1ZTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBXcml0ZXMgYW4gaW5saW5lIGJsb2NrIHdpdGggYnJhY2VzLlxuICAgKiBAcGFyYW0gYmxvY2sgLSBXcml0ZSB1c2luZyB0aGUgd3JpdGVyIHdpdGhpbiB0aGlzIGJsb2NrLlxuICAgKi9cbiAgaW5saW5lQmxvY2soYmxvY2s/OiAoKSA9PiB2b2lkKTogdGhpcyB7XG4gICAgdGhpcy5fbmV3TGluZUlmTmV3TGluZU9uTmV4dFdyaXRlKCk7XG4gICAgdGhpcy53cml0ZShcIntcIik7XG4gICAgdGhpcy5faW5kZW50QmxvY2tJbnRlcm5hbChibG9jayk7XG4gICAgdGhpcy5uZXdMaW5lSWZMYXN0Tm90KCkud3JpdGUoXCJ9XCIpO1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogSW5kZW50cyB0aGUgY29kZSBvbmUgbGV2ZWwgZm9yIHRoZSBjdXJyZW50IGxpbmUuXG4gICAqL1xuICBpbmRlbnQodGltZXM/OiBudW1iZXIpOiB0aGlzO1xuICAvKipcbiAgICogSW5kZW50cyBhIGJsb2NrIG9mIGNvZGUuXG4gICAqIEBwYXJhbSBibG9jayAtIEJsb2NrIHRvIGluZGVudC5cbiAgICovXG4gIGluZGVudChibG9jazogKCkgPT4gdm9pZCk6IHRoaXM7XG4gIGluZGVudCh0aW1lc09yQmxvY2s6IG51bWJlciB8ICgoKSA9PiB2b2lkKSA9IDEpIHtcbiAgICBpZiAodHlwZW9mIHRpbWVzT3JCbG9jayA9PT0gXCJudW1iZXJcIikge1xuICAgICAgdGhpcy5fbmV3TGluZUlmTmV3TGluZU9uTmV4dFdyaXRlKCk7XG4gICAgICByZXR1cm4gdGhpcy53cml0ZSh0aGlzLl9pbmRlbnRhdGlvblRleHQucmVwZWF0KHRpbWVzT3JCbG9jaykpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9pbmRlbnRCbG9ja0ludGVybmFsKHRpbWVzT3JCbG9jayk7XG4gICAgICBpZiAoIXRoaXMuaXNMYXN0TmV3TGluZSgpKSB7XG4gICAgICAgIHRoaXMuX25ld0xpbmVPbk5leHRXcml0ZSA9IHRydWU7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIHByaXZhdGUgX2luZGVudEJsb2NrSW50ZXJuYWwoYmxvY2s/OiAoKSA9PiB2b2lkKSB7XG4gICAgaWYgKHRoaXMuZ2V0TGFzdENoYXIoKSAhPSBudWxsKSB7XG4gICAgICB0aGlzLm5ld0xpbmVJZkxhc3ROb3QoKTtcbiAgICB9XG4gICAgdGhpcy5fY3VycmVudEluZGVudGF0aW9uKys7XG4gICAgdGhpcy5faXNPbkZpcnN0TGluZU9mQmxvY2sgPSB0cnVlO1xuICAgIGlmIChibG9jayAhPSBudWxsKSB7XG4gICAgICBibG9jaygpO1xuICAgIH1cbiAgICB0aGlzLl9pc09uRmlyc3RMaW5lT2ZCbG9jayA9IGZhbHNlO1xuICAgIHRoaXMuX2N1cnJlbnRJbmRlbnRhdGlvbiA9IE1hdGgubWF4KDAsIHRoaXMuX2N1cnJlbnRJbmRlbnRhdGlvbiAtIDEpO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbmRpdGlvbmFsbHkgd3JpdGVzIGEgbGluZSBvZiB0ZXh0LlxuICAgKiBAcGFyYW0gY29uZGl0aW9uIC0gQ29uZGl0aW9uIHRvIGV2YWx1YXRlLlxuICAgKiBAcGFyYW0gdGV4dEZ1bmMgLSBBIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhIHN0cmluZyB0byB3cml0ZSBpZiB0aGUgY29uZGl0aW9uIGlzIHRydWUuXG4gICAqL1xuICBjb25kaXRpb25hbFdyaXRlTGluZShjb25kaXRpb246IGJvb2xlYW4gfCB1bmRlZmluZWQsIHRleHRGdW5jOiAoKSA9PiBzdHJpbmcpOiB0aGlzO1xuICAvKipcbiAgICogQ29uZGl0aW9uYWxseSB3cml0ZXMgYSBsaW5lIG9mIHRleHQuXG4gICAqIEBwYXJhbSBjb25kaXRpb24gLSBDb25kaXRpb24gdG8gZXZhbHVhdGUuXG4gICAqIEBwYXJhbSB0ZXh0IC0gVGV4dCB0byB3cml0ZSBpZiB0aGUgY29uZGl0aW9uIGlzIHRydWUuXG4gICAqL1xuICBjb25kaXRpb25hbFdyaXRlTGluZShjb25kaXRpb246IGJvb2xlYW4gfCB1bmRlZmluZWQsIHRleHQ6IHN0cmluZyk6IHRoaXM7XG4gIGNvbmRpdGlvbmFsV3JpdGVMaW5lKGNvbmRpdGlvbjogYm9vbGVhbiB8IHVuZGVmaW5lZCwgc3RyT3JGdW5jOiBzdHJpbmcgfCAoKCkgPT4gc3RyaW5nKSkge1xuICAgIGlmIChjb25kaXRpb24pIHtcbiAgICAgIHRoaXMud3JpdGVMaW5lKGdldFN0cmluZ0Zyb21TdHJPckZ1bmMoc3RyT3JGdW5jKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogV3JpdGVzIGEgbGluZSBvZiB0ZXh0LlxuICAgKiBAcGFyYW0gdGV4dCAtIFN0cmluZyB0byB3cml0ZS5cbiAgICovXG4gIHdyaXRlTGluZSh0ZXh0OiBzdHJpbmcpOiB0aGlzIHtcbiAgICB0aGlzLl9uZXdMaW5lSWZOZXdMaW5lT25OZXh0V3JpdGUoKTtcbiAgICBpZiAodGhpcy5nZXRMYXN0Q2hhcigpICE9IG51bGwpIHtcbiAgICAgIHRoaXMubmV3TGluZUlmTGFzdE5vdCgpO1xuICAgIH1cbiAgICB0aGlzLl93cml0ZUluZGVudGluZ05ld0xpbmVzKHRleHQpO1xuICAgIHRoaXMubmV3TGluZSgpO1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogV3JpdGVzIGEgbmV3bGluZSBpZiB0aGUgbGFzdCBsaW5lIHdhcyBub3QgYSBuZXdsaW5lLlxuICAgKi9cbiAgbmV3TGluZUlmTGFzdE5vdCgpOiB0aGlzIHtcbiAgICB0aGlzLl9uZXdMaW5lSWZOZXdMaW5lT25OZXh0V3JpdGUoKTtcblxuICAgIGlmICghdGhpcy5pc0xhc3ROZXdMaW5lKCkpIHtcbiAgICAgIHRoaXMubmV3TGluZSgpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFdyaXRlcyBhIGJsYW5rIGxpbmUgaWYgdGhlIGxhc3Qgd3JpdHRlbiB0ZXh0IHdhcyBub3QgYSBibGFuayBsaW5lLlxuICAgKi9cbiAgYmxhbmtMaW5lSWZMYXN0Tm90KCk6IHRoaXMge1xuICAgIGlmICghdGhpcy5pc0xhc3RCbGFua0xpbmUoKSkge1xuICAgICAgdGhpcy5ibGFua0xpbmUoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogV3JpdGVzIGEgYmxhbmsgbGluZSBpZiB0aGUgY29uZGl0aW9uIGlzIHRydWUuXG4gICAqIEBwYXJhbSBjb25kaXRpb24gLSBDb25kaXRpb24gdG8gZXZhbHVhdGUuXG4gICAqL1xuICBjb25kaXRpb25hbEJsYW5rTGluZShjb25kaXRpb246IGJvb2xlYW4gfCB1bmRlZmluZWQpOiB0aGlzIHtcbiAgICBpZiAoY29uZGl0aW9uKSB7XG4gICAgICB0aGlzLmJsYW5rTGluZSgpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBXcml0ZXMgYSBibGFuayBsaW5lLlxuICAgKi9cbiAgYmxhbmtMaW5lKCk6IHRoaXMge1xuICAgIHJldHVybiB0aGlzLm5ld0xpbmVJZkxhc3ROb3QoKS5uZXdMaW5lKCk7XG4gIH1cblxuICAvKipcbiAgICogV3JpdGVzIGEgbmV3bGluZSBpZiB0aGUgY29uZGl0aW9uIGlzIHRydWUuXG4gICAqIEBwYXJhbSBjb25kaXRpb24gLSBDb25kaXRpb24gdG8gZXZhbHVhdGUuXG4gICAqL1xuICBjb25kaXRpb25hbE5ld0xpbmUoY29uZGl0aW9uOiBib29sZWFuIHwgdW5kZWZpbmVkKTogdGhpcyB7XG4gICAgaWYgKGNvbmRpdGlvbikge1xuICAgICAgdGhpcy5uZXdMaW5lKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFdyaXRlcyBhIG5ld2xpbmUuXG4gICAqL1xuICBuZXdMaW5lKCk6IHRoaXMge1xuICAgIHRoaXMuX25ld0xpbmVPbk5leHRXcml0ZSA9IGZhbHNlO1xuICAgIHRoaXMuX2Jhc2VXcml0ZU5ld2xpbmUoKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBXcml0ZXMgYSBxdW90ZSBjaGFyYWN0ZXIuXG4gICAqL1xuICBxdW90ZSgpOiB0aGlzO1xuICAvKipcbiAgICogV3JpdGVzIHRleHQgc3Vycm91bmRlZCBpbiBxdW90ZXMuXG4gICAqIEBwYXJhbSB0ZXh0IC0gVGV4dCB0byB3cml0ZS5cbiAgICovXG4gIHF1b3RlKHRleHQ6IHN0cmluZyk6IHRoaXM7XG4gIHF1b3RlKHRleHQ/OiBzdHJpbmcpIHtcbiAgICB0aGlzLl9uZXdMaW5lSWZOZXdMaW5lT25OZXh0V3JpdGUoKTtcbiAgICB0aGlzLl93cml0ZUluZGVudGluZ05ld0xpbmVzKHRleHQgPT0gbnVsbCA/IHRoaXMuX3F1b3RlQ2hhciA6IHRoaXMuX3F1b3RlQ2hhciArIGVzY2FwZUZvcldpdGhpblN0cmluZyh0ZXh0LCB0aGlzLl9xdW90ZUNoYXIpICsgdGhpcy5fcXVvdGVDaGFyKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBXcml0ZXMgYSBzcGFjZSBpZiB0aGUgbGFzdCBjaGFyYWN0ZXIgd2FzIG5vdCBhIHNwYWNlLlxuICAgKi9cbiAgc3BhY2VJZkxhc3ROb3QoKTogdGhpcyB7XG4gICAgdGhpcy5fbmV3TGluZUlmTmV3TGluZU9uTmV4dFdyaXRlKCk7XG5cbiAgICBpZiAoIXRoaXMuaXNMYXN0U3BhY2UoKSkge1xuICAgICAgdGhpcy5fd3JpdGVJbmRlbnRpbmdOZXdMaW5lcyhcIiBcIik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogV3JpdGVzIGEgc3BhY2UuXG4gICAqIEBwYXJhbSB0aW1lcyAtIE51bWJlciBvZiB0aW1lcyB0byB3cml0ZSBhIHNwYWNlLlxuICAgKi9cbiAgc3BhY2UodGltZXMgPSAxKTogdGhpcyB7XG4gICAgdGhpcy5fbmV3TGluZUlmTmV3TGluZU9uTmV4dFdyaXRlKCk7XG4gICAgdGhpcy5fd3JpdGVJbmRlbnRpbmdOZXdMaW5lcyhcIiBcIi5yZXBlYXQodGltZXMpKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBXcml0ZXMgYSB0YWIgaWYgdGhlIGxhc3QgY2hhcmFjdGVyIHdhcyBub3QgYSB0YWIuXG4gICAqL1xuICB0YWJJZkxhc3ROb3QoKTogdGhpcyB7XG4gICAgdGhpcy5fbmV3TGluZUlmTmV3TGluZU9uTmV4dFdyaXRlKCk7XG5cbiAgICBpZiAoIXRoaXMuaXNMYXN0VGFiKCkpIHtcbiAgICAgIHRoaXMuX3dyaXRlSW5kZW50aW5nTmV3TGluZXMoXCJcXHRcIik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogV3JpdGVzIGEgdGFiLlxuICAgKiBAcGFyYW0gdGltZXMgLSBOdW1iZXIgb2YgdGltZXMgdG8gd3JpdGUgYSB0YWIuXG4gICAqL1xuICB0YWIodGltZXMgPSAxKTogdGhpcyB7XG4gICAgdGhpcy5fbmV3TGluZUlmTmV3TGluZU9uTmV4dFdyaXRlKCk7XG4gICAgdGhpcy5fd3JpdGVJbmRlbnRpbmdOZXdMaW5lcyhcIlxcdFwiLnJlcGVhdCh0aW1lcykpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbmRpdGlvbmFsbHkgd3JpdGVzIHRleHQuXG4gICAqIEBwYXJhbSBjb25kaXRpb24gLSBDb25kaXRpb24gdG8gZXZhbHVhdGUuXG4gICAqIEBwYXJhbSB0ZXh0RnVuYyAtIEEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGEgc3RyaW5nIHRvIHdyaXRlIGlmIHRoZSBjb25kaXRpb24gaXMgdHJ1ZS5cbiAgICovXG4gIGNvbmRpdGlvbmFsV3JpdGUoY29uZGl0aW9uOiBib29sZWFuIHwgdW5kZWZpbmVkLCB0ZXh0RnVuYzogKCkgPT4gc3RyaW5nKTogdGhpcztcbiAgLyoqXG4gICAqIENvbmRpdGlvbmFsbHkgd3JpdGVzIHRleHQuXG4gICAqIEBwYXJhbSBjb25kaXRpb24gLSBDb25kaXRpb24gdG8gZXZhbHVhdGUuXG4gICAqIEBwYXJhbSB0ZXh0IC0gVGV4dCB0byB3cml0ZSBpZiB0aGUgY29uZGl0aW9uIGlzIHRydWUuXG4gICAqL1xuICBjb25kaXRpb25hbFdyaXRlKGNvbmRpdGlvbjogYm9vbGVhbiB8IHVuZGVmaW5lZCwgdGV4dDogc3RyaW5nKTogdGhpcztcbiAgY29uZGl0aW9uYWxXcml0ZShjb25kaXRpb246IGJvb2xlYW4gfCB1bmRlZmluZWQsIHRleHRPckZ1bmM6IHN0cmluZyB8ICgoKSA9PiBzdHJpbmcpKSB7XG4gICAgaWYgKGNvbmRpdGlvbikge1xuICAgICAgdGhpcy53cml0ZShnZXRTdHJpbmdGcm9tU3RyT3JGdW5jKHRleHRPckZ1bmMpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBXcml0ZXMgdGhlIHByb3ZpZGVkIHRleHQuXG4gICAqIEBwYXJhbSB0ZXh0IC0gVGV4dCB0byB3cml0ZS5cbiAgICovXG4gIHdyaXRlKHRleHQ6IHN0cmluZyk6IHRoaXMge1xuICAgIHRoaXMuX25ld0xpbmVJZk5ld0xpbmVPbk5leHRXcml0ZSgpO1xuICAgIHRoaXMuX3dyaXRlSW5kZW50aW5nTmV3TGluZXModGV4dCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogV3JpdGVzIHRleHQgdG8gZXhpdCBhIGNvbW1lbnQgaWYgaW4gYSBjb21tZW50LlxuICAgKi9cbiAgY2xvc2VDb21tZW50KCk6IHRoaXMge1xuICAgIGNvbnN0IGNvbW1lbnRDaGFyID0gdGhpcy5fY3VycmVudENvbW1lbnRDaGFyO1xuXG4gICAgc3dpdGNoIChjb21tZW50Q2hhcikge1xuICAgICAgY2FzZSBDb21tZW50Q2hhci5MaW5lOlxuICAgICAgICB0aGlzLm5ld0xpbmUoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIENvbW1lbnRDaGFyLlN0YXI6XG4gICAgICAgIGlmICghdGhpcy5pc0xhc3ROZXdMaW5lKCkpIHtcbiAgICAgICAgICB0aGlzLnNwYWNlSWZMYXN0Tm90KCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy53cml0ZShcIiovXCIpO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgY29uc3QgX2Fzc2VydFVuZGVmaW5lZDogdW5kZWZpbmVkID0gY29tbWVudENoYXI7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIEluc2VydHMgdGV4dCBhdCB0aGUgcHJvdmlkZWQgcG9zaXRpb24uXG4gICAqXG4gICAqIFRoaXMgbWV0aG9kIGlzIFwidW5zYWZlXCIgYmVjYXVzZSBpdCB3b24ndCB1cGRhdGUgdGhlIHN0YXRlIG9mIHRoZSB3cml0ZXIgdW5sZXNzXG4gICAqIGluc2VydGluZyBhdCB0aGUgZW5kIHBvc2l0aW9uLiBJdCBpcyBiaWFzZWQgdG93YXJkcyBiZWluZyBmYXN0IGF0IGluc2VydGluZyBjbG9zZXJcbiAgICogdG8gdGhlIHN0YXJ0IG9yIGVuZCwgYnV0IHNsb3dlciB0byBpbnNlcnQgaW4gdGhlIG1pZGRsZS4gT25seSB1c2UgdGhpcyBpZlxuICAgKiBhYnNvbHV0ZWx5IG5lY2Vzc2FyeS5cbiAgICogQHBhcmFtIHBvcyAtIFBvc2l0aW9uIHRvIGluc2VydCBhdC5cbiAgICogQHBhcmFtIHRleHQgLSBUZXh0IHRvIGluc2VydC5cbiAgICovXG4gIHVuc2FmZUluc2VydChwb3M6IG51bWJlciwgdGV4dDogc3RyaW5nKTogdGhpcyB7XG4gICAgY29uc3QgdGV4dExlbmd0aCA9IHRoaXMuX2xlbmd0aDtcbiAgICBjb25zdCB0ZXh0cyA9IHRoaXMuX3RleHRzO1xuICAgIHZlcmlmeUlucHV0KCk7XG5cbiAgICBpZiAocG9zID09PSB0ZXh0TGVuZ3RoKSB7XG4gICAgICByZXR1cm4gdGhpcy53cml0ZSh0ZXh0KTtcbiAgICB9XG5cbiAgICB1cGRhdGVJbnRlcm5hbEFycmF5KCk7XG4gICAgdGhpcy5fbGVuZ3RoICs9IHRleHQubGVuZ3RoO1xuXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgICBmdW5jdGlvbiB2ZXJpZnlJbnB1dCgpIHtcbiAgICAgIGlmIChwb3MgPCAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgUHJvdmlkZWQgcG9zaXRpb24gb2YgJyR7cG9zfScgd2FzIGxlc3MgdGhhbiB6ZXJvLmApO1xuICAgICAgfVxuICAgICAgaWYgKHBvcyA+IHRleHRMZW5ndGgpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQcm92aWRlZCBwb3NpdGlvbiBvZiAnJHtwb3N9JyB3YXMgZ3JlYXRlciB0aGFuIHRoZSB0ZXh0IGxlbmd0aCBvZiAnJHt0ZXh0TGVuZ3RofScuYCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdXBkYXRlSW50ZXJuYWxBcnJheSgpIHtcbiAgICAgIGNvbnN0IHsgaW5kZXgsIGxvY2FsSW5kZXggfSA9IGdldEFycmF5SW5kZXhBbmRMb2NhbEluZGV4KCk7XG5cbiAgICAgIGlmIChsb2NhbEluZGV4ID09PSAwKSB7XG4gICAgICAgIHRleHRzLnNwbGljZShpbmRleCwgMCwgdGV4dCk7XG4gICAgICB9IGVsc2UgaWYgKGxvY2FsSW5kZXggPT09IHRleHRzW2luZGV4XS5sZW5ndGgpIHtcbiAgICAgICAgdGV4dHMuc3BsaWNlKGluZGV4ICsgMSwgMCwgdGV4dCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCB0ZXh0SXRlbSA9IHRleHRzW2luZGV4XTtcbiAgICAgICAgY29uc3Qgc3RhcnRUZXh0ID0gdGV4dEl0ZW0uc3Vic3RyaW5nKDAsIGxvY2FsSW5kZXgpO1xuICAgICAgICBjb25zdCBlbmRUZXh0ID0gdGV4dEl0ZW0uc3Vic3RyaW5nKGxvY2FsSW5kZXgpO1xuICAgICAgICB0ZXh0cy5zcGxpY2UoaW5kZXgsIDEsIHN0YXJ0VGV4dCwgdGV4dCwgZW5kVGV4dCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0QXJyYXlJbmRleEFuZExvY2FsSW5kZXgoKSB7XG4gICAgICBpZiAocG9zIDwgdGV4dExlbmd0aCAvIDIpIHtcbiAgICAgICAgLy8gc3RhcnQgc2VhcmNoaW5nIGZyb20gdGhlIGZyb250XG4gICAgICAgIGxldCBlbmRQb3MgPSAwO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRleHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgY29uc3QgdGV4dEl0ZW0gPSB0ZXh0c1tpXTtcbiAgICAgICAgICBjb25zdCBzdGFydFBvcyA9IGVuZFBvcztcbiAgICAgICAgICBlbmRQb3MgKz0gdGV4dEl0ZW0ubGVuZ3RoO1xuICAgICAgICAgIGlmIChlbmRQb3MgPj0gcG9zKSB7XG4gICAgICAgICAgICByZXR1cm4geyBpbmRleDogaSwgbG9jYWxJbmRleDogcG9zIC0gc3RhcnRQb3MgfTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHN0YXJ0IHNlYXJjaGluZyBmcm9tIHRoZSBiYWNrXG4gICAgICAgIGxldCBzdGFydFBvcyA9IHRleHRMZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSB0ZXh0cy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICAgIGNvbnN0IHRleHRJdGVtID0gdGV4dHNbaV07XG4gICAgICAgICAgc3RhcnRQb3MgLT0gdGV4dEl0ZW0ubGVuZ3RoO1xuICAgICAgICAgIGlmIChzdGFydFBvcyA8PSBwb3MpIHtcbiAgICAgICAgICAgIHJldHVybiB7IGluZGV4OiBpLCBsb2NhbEluZGV4OiBwb3MgLSBzdGFydFBvcyB9O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmhhbmRsZWQgc2l0dWF0aW9uIGluc2VydGluZy4gVGhpcyBzaG91bGQgbmV2ZXIgaGFwcGVuLlwiKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogR2V0cyB0aGUgbGVuZ3RoIG9mIHRoZSBzdHJpbmcgaW4gdGhlIHdyaXRlci5cbiAgICovXG4gIGdldExlbmd0aCgpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLl9sZW5ndGg7XG4gIH1cblxuICAvKipcbiAgICogR2V0cyBpZiB0aGUgd3JpdGVyIGlzIGN1cnJlbnRseSBpbiBhIGNvbW1lbnQuXG4gICAqL1xuICBpc0luQ29tbWVudCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5fY3VycmVudENvbW1lbnRDaGFyICE9PSB1bmRlZmluZWQ7XG4gIH1cblxuICAvKipcbiAgICogR2V0cyBpZiB0aGUgd3JpdGVyIGlzIGN1cnJlbnRseSBhdCB0aGUgc3RhcnQgb2YgdGhlIGZpcnN0IGxpbmUgb2YgdGhlIHRleHQsIGJsb2NrLCBvciBpbmRlbnRhdGlvbiBibG9jay5cbiAgICovXG4gIGlzQXRTdGFydE9mRmlyc3RMaW5lT2ZCbG9jaygpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5pc09uRmlyc3RMaW5lT2ZCbG9jaygpICYmICh0aGlzLmlzTGFzdE5ld0xpbmUoKSB8fCB0aGlzLmdldExhc3RDaGFyKCkgPT0gbnVsbCk7XG4gIH1cblxuICAvKipcbiAgICogR2V0cyBpZiB0aGUgd3JpdGVyIGlzIGN1cnJlbnRseSBvbiB0aGUgZmlyc3QgbGluZSBvZiB0aGUgdGV4dCwgYmxvY2ssIG9yIGluZGVudGF0aW9uIGJsb2NrLlxuICAgKi9cbiAgaXNPbkZpcnN0TGluZU9mQmxvY2soKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuX2lzT25GaXJzdExpbmVPZkJsb2NrO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgaWYgdGhlIHdyaXRlciBpcyBjdXJyZW50bHkgaW4gYSBzdHJpbmcuXG4gICAqL1xuICBpc0luU3RyaW5nKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLl9zdHJpbmdDaGFyU3RhY2subGVuZ3RoID4gMCAmJiB0aGlzLl9zdHJpbmdDaGFyU3RhY2tbdGhpcy5fc3RyaW5nQ2hhclN0YWNrLmxlbmd0aCAtIDFdICE9PSBDSEFSUy5PUEVOX0JSQUNFO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgaWYgdGhlIGxhc3QgY2hhcnMgd3JpdHRlbiB3ZXJlIGZvciBhIG5ld2xpbmUuXG4gICAqL1xuICBpc0xhc3ROZXdMaW5lKCk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IGxhc3RDaGFyID0gdGhpcy5nZXRMYXN0Q2hhcigpO1xuICAgIHJldHVybiBsYXN0Q2hhciA9PT0gXCJcXG5cIiB8fCBsYXN0Q2hhciA9PT0gXCJcXHJcIjtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIGlmIHRoZSBsYXN0IGNoYXJzIHdyaXR0ZW4gd2VyZSBmb3IgYSBibGFuayBsaW5lLlxuICAgKi9cbiAgaXNMYXN0QmxhbmtMaW5lKCk6IGJvb2xlYW4ge1xuICAgIGxldCBmb3VuZENvdW50ID0gMDtcblxuICAgIC8vIHRvZG86IGNvbnNpZGVyIGV4dHJhY3Rpbmcgb3V0IGl0ZXJhdGluZyBvdmVyIHBhc3QgY2hhcmFjdGVycywgYnV0IGRvbid0IHVzZVxuICAgIC8vIGFuIGl0ZXJhdG9yIGJlY2F1c2UgaXQgd2lsbCBiZSBzbG93LlxuICAgIGZvciAobGV0IGkgPSB0aGlzLl90ZXh0cy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgY29uc3QgY3VycmVudFRleHQgPSB0aGlzLl90ZXh0c1tpXTtcbiAgICAgIGZvciAobGV0IGogPSBjdXJyZW50VGV4dC5sZW5ndGggLSAxOyBqID49IDA7IGotLSkge1xuICAgICAgICBjb25zdCBjdXJyZW50Q2hhciA9IGN1cnJlbnRUZXh0LmNoYXJDb2RlQXQoaik7XG4gICAgICAgIGlmIChjdXJyZW50Q2hhciA9PT0gQ0hBUlMuTkVXX0xJTkUpIHtcbiAgICAgICAgICBmb3VuZENvdW50Kys7XG4gICAgICAgICAgaWYgKGZvdW5kQ291bnQgPT09IDIpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChjdXJyZW50Q2hhciAhPT0gQ0hBUlMuQ0FSUklBR0VfUkVUVVJOKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgaWYgdGhlIGxhc3QgY2hhciB3cml0dGVuIHdhcyBhIHNwYWNlLlxuICAgKi9cbiAgaXNMYXN0U3BhY2UoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0TGFzdENoYXIoKSA9PT0gXCIgXCI7XG4gIH1cblxuICAvKipcbiAgICogR2V0cyBpZiB0aGUgbGFzdCBjaGFyIHdyaXR0ZW4gd2FzIGEgdGFiLlxuICAgKi9cbiAgaXNMYXN0VGFiKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmdldExhc3RDaGFyKCkgPT09IFwiXFx0XCI7XG4gIH1cblxuICAvKipcbiAgICogR2V0cyB0aGUgbGFzdCBjaGFyIHdyaXR0ZW4uXG4gICAqL1xuICBnZXRMYXN0Q2hhcigpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAgIGNvbnN0IGNoYXJDb2RlID0gdGhpcy5fZ2V0TGFzdENoYXJDb2RlV2l0aE9mZnNldCgwKTtcbiAgICByZXR1cm4gY2hhckNvZGUgPT0gbnVsbCA/IHVuZGVmaW5lZCA6IFN0cmluZy5mcm9tQ2hhckNvZGUoY2hhckNvZGUpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgaWYgdGhlIHdyaXRlciBlbmRzIHdpdGggdGhlIHByb3ZpZGVkIHRleHQuXG4gICAqIEBwYXJhbSB0ZXh0IC0gVGV4dCB0byBjaGVjayBpZiB0aGUgd3JpdGVyIGVuZHMgd2l0aCB0aGUgcHJvdmlkZWQgdGV4dC5cbiAgICovXG4gIGVuZHNXaXRoKHRleHQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IGxlbmd0aCA9IHRoaXMuX2xlbmd0aDtcbiAgICByZXR1cm4gdGhpcy5pdGVyYXRlTGFzdENoYXJDb2RlcygoY2hhckNvZGUsIGluZGV4KSA9PiB7XG4gICAgICBjb25zdCBvZmZzZXQgPSBsZW5ndGggLSBpbmRleDtcbiAgICAgIGNvbnN0IHRleHRJbmRleCA9IHRleHQubGVuZ3RoIC0gb2Zmc2V0O1xuICAgICAgaWYgKHRleHQuY2hhckNvZGVBdCh0ZXh0SW5kZXgpICE9PSBjaGFyQ29kZSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGV4dEluZGV4ID09PSAwID8gdHJ1ZSA6IHVuZGVmaW5lZDtcbiAgICB9KSB8fCBmYWxzZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJdGVyYXRlcyBvdmVyIHRoZSB3cml0ZXIgY2hhcmFjdGVycyBpbiByZXZlcnNlIG9yZGVyLiBUaGUgaXRlcmF0aW9uIHN0b3BzIHdoZW4gYSBub24tbnVsbCBvclxuICAgKiB1bmRlZmluZWQgdmFsdWUgaXMgcmV0dXJuZWQgZnJvbSB0aGUgYWN0aW9uLiBUaGUgcmV0dXJuZWQgdmFsdWUgaXMgdGhlbiByZXR1cm5lZCBieSB0aGUgbWV0aG9kLlxuICAgKlxuICAgKiBAcmVtYXJrcyBJdCBpcyBtdWNoIG1vcmUgZWZmaWNpZW50IHRvIHVzZSB0aGlzIG1ldGhvZCByYXRoZXIgdGhhbiBgI3RvU3RyaW5nKClgIHNpbmNlIGAjdG9TdHJpbmcoKWBcbiAgICogd2lsbCBjb21iaW5lIHRoZSBpbnRlcm5hbCBhcnJheSBpbnRvIGEgc3RyaW5nLlxuICAgKi9cbiAgaXRlcmF0ZUxhc3RDaGFyczxUPihhY3Rpb246IChjaGFyOiBzdHJpbmcsIGluZGV4OiBudW1iZXIpID0+IFQgfCB1bmRlZmluZWQpOiBUIHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy5pdGVyYXRlTGFzdENoYXJDb2RlcygoY2hhckNvZGUsIGluZGV4KSA9PiBhY3Rpb24oU3RyaW5nLmZyb21DaGFyQ29kZShjaGFyQ29kZSksIGluZGV4KSk7XG4gIH1cblxuICAvKipcbiAgICogSXRlcmF0ZXMgb3ZlciB0aGUgd3JpdGVyIGNoYXJhY3RlciBjaGFyIGNvZGVzIGluIHJldmVyc2Ugb3JkZXIuIFRoZSBpdGVyYXRpb24gc3RvcHMgd2hlbiBhIG5vbi1udWxsIG9yXG4gICAqIHVuZGVmaW5lZCB2YWx1ZSBpcyByZXR1cm5lZCBmcm9tIHRoZSBhY3Rpb24uIFRoZSByZXR1cm5lZCB2YWx1ZSBpcyB0aGVuIHJldHVybmVkIGJ5IHRoZSBtZXRob2QuXG4gICAqXG4gICAqIEByZW1hcmtzIEl0IGlzIG11Y2ggbW9yZSBlZmZpY2llbnQgdG8gdXNlIHRoaXMgbWV0aG9kIHJhdGhlciB0aGFuIGAjdG9TdHJpbmcoKWAgc2luY2UgYCN0b1N0cmluZygpYFxuICAgKiB3aWxsIGNvbWJpbmUgdGhlIGludGVybmFsIGFycmF5IGludG8gYSBzdHJpbmcuIEFkZGl0aW9uYWxseSwgdGhpcyBpcyBzbGlnaHRseSBtb3JlIGVmZmljaWVudCB0aGF0XG4gICAqIGBpdGVyYXRlTGFzdENoYXJzYCBhcyB0aGlzIHdvbid0IGFsbG9jYXRlIGEgc3RyaW5nIHBlciBjaGFyYWN0ZXIuXG4gICAqL1xuICBpdGVyYXRlTGFzdENoYXJDb2RlczxUPihhY3Rpb246IChjaGFyQ29kZTogbnVtYmVyLCBpbmRleDogbnVtYmVyKSA9PiBUIHwgdW5kZWZpbmVkKTogVCB8IHVuZGVmaW5lZCB7XG4gICAgbGV0IGluZGV4ID0gdGhpcy5fbGVuZ3RoO1xuICAgIGZvciAobGV0IGkgPSB0aGlzLl90ZXh0cy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgY29uc3QgY3VycmVudFRleHQgPSB0aGlzLl90ZXh0c1tpXTtcbiAgICAgIGZvciAobGV0IGogPSBjdXJyZW50VGV4dC5sZW5ndGggLSAxOyBqID49IDA7IGotLSkge1xuICAgICAgICBpbmRleC0tO1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhY3Rpb24oY3VycmVudFRleHQuY2hhckNvZGVBdChqKSwgaW5kZXgpO1xuICAgICAgICBpZiAocmVzdWx0ICE9IG51bGwpIHtcbiAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICAvKipcbiAgICogR2V0cyB0aGUgd3JpdGVyJ3MgdGV4dC5cbiAgICovXG4gIHRvU3RyaW5nKCk6IHN0cmluZyB7XG4gICAgaWYgKHRoaXMuX3RleHRzLmxlbmd0aCA+IDEpIHtcbiAgICAgIGNvbnN0IHRleHQgPSB0aGlzLl90ZXh0cy5qb2luKFwiXCIpO1xuICAgICAgdGhpcy5fdGV4dHMubGVuZ3RoID0gMDtcbiAgICAgIHRoaXMuX3RleHRzLnB1c2godGV4dCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuX3RleHRzWzBdIHx8IFwiXCI7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IF9uZXdMaW5lUmVnRXggPSAvXFxyP1xcbi87XG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgcHJpdmF0ZSBfd3JpdGVJbmRlbnRpbmdOZXdMaW5lcyh0ZXh0OiBzdHJpbmcpIHtcbiAgICB0ZXh0ID0gdGV4dCB8fCBcIlwiO1xuICAgIGlmICh0ZXh0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgd3JpdGVJbmRpdmlkdWFsKHRoaXMsIFwiXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGl0ZW1zID0gdGV4dC5zcGxpdChDb2RlQmxvY2tXcml0ZXIuX25ld0xpbmVSZWdFeCk7XG4gICAgaXRlbXMuZm9yRWFjaCgocywgaSkgPT4ge1xuICAgICAgaWYgKGkgPiAwKSB7XG4gICAgICAgIHRoaXMuX2Jhc2VXcml0ZU5ld2xpbmUoKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgd3JpdGVJbmRpdmlkdWFsKHRoaXMsIHMpO1xuICAgIH0pO1xuXG4gICAgZnVuY3Rpb24gd3JpdGVJbmRpdmlkdWFsKHdyaXRlcjogQ29kZUJsb2NrV3JpdGVyLCBzOiBzdHJpbmcpIHtcbiAgICAgIGlmICghd3JpdGVyLmlzSW5TdHJpbmcoKSkge1xuICAgICAgICBjb25zdCBpc0F0U3RhcnRPZkxpbmUgPSB3cml0ZXIuaXNMYXN0TmV3TGluZSgpIHx8IHdyaXRlci5nZXRMYXN0Q2hhcigpID09IG51bGw7XG4gICAgICAgIGlmIChpc0F0U3RhcnRPZkxpbmUpIHtcbiAgICAgICAgICB3cml0ZXIuX3dyaXRlSW5kZW50YXRpb24oKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB3cml0ZXIuX3VwZGF0ZUludGVybmFsU3RhdGUocyk7XG4gICAgICB3cml0ZXIuX2ludGVybmFsV3JpdGUocyk7XG4gICAgfVxuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBwcml2YXRlIF9iYXNlV3JpdGVOZXdsaW5lKCkge1xuICAgIGlmICh0aGlzLl9jdXJyZW50Q29tbWVudENoYXIgPT09IENvbW1lbnRDaGFyLkxpbmUpIHtcbiAgICAgIHRoaXMuX2N1cnJlbnRDb21tZW50Q2hhciA9IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBjb25zdCBsYXN0U3RyaW5nQ2hhck9uU3RhY2sgPSB0aGlzLl9zdHJpbmdDaGFyU3RhY2tbdGhpcy5fc3RyaW5nQ2hhclN0YWNrLmxlbmd0aCAtIDFdO1xuICAgIGlmICgobGFzdFN0cmluZ0NoYXJPblN0YWNrID09PSBDSEFSUy5ET1VCTEVfUVVPVEUgfHwgbGFzdFN0cmluZ0NoYXJPblN0YWNrID09PSBDSEFSUy5TSU5HTEVfUVVPVEUpICYmIHRoaXMuX2dldExhc3RDaGFyQ29kZVdpdGhPZmZzZXQoMCkgIT09IENIQVJTLkJBQ0tfU0xBU0gpIHtcbiAgICAgIHRoaXMuX3N0cmluZ0NoYXJTdGFjay5wb3AoKTtcbiAgICB9XG5cbiAgICB0aGlzLl9pbnRlcm5hbFdyaXRlKHRoaXMuX25ld0xpbmUpO1xuICAgIHRoaXMuX2lzT25GaXJzdExpbmVPZkJsb2NrID0gZmFsc2U7XG4gICAgdGhpcy5fZGVxdWV1ZVF1ZXVlZEluZGVudGF0aW9uKCk7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIHByaXZhdGUgX2RlcXVldWVRdWV1ZWRJbmRlbnRhdGlvbigpIHtcbiAgICBpZiAodGhpcy5fcXVldWVkSW5kZW50YXRpb24gPT0gbnVsbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9xdWV1ZWRPbmx5SWZOb3RCbG9jayAmJiB3YXNMYXN0QmxvY2sodGhpcykpIHtcbiAgICAgIHRoaXMuX3F1ZXVlZEluZGVudGF0aW9uID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5fcXVldWVkT25seUlmTm90QmxvY2sgPSB1bmRlZmluZWQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2N1cnJlbnRJbmRlbnRhdGlvbiA9IHRoaXMuX3F1ZXVlZEluZGVudGF0aW9uO1xuICAgICAgdGhpcy5fcXVldWVkSW5kZW50YXRpb24gPSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gd2FzTGFzdEJsb2NrKHdyaXRlcjogQ29kZUJsb2NrV3JpdGVyKSB7XG4gICAgICBsZXQgZm91bmROZXdMaW5lID0gZmFsc2U7XG4gICAgICByZXR1cm4gd3JpdGVyLml0ZXJhdGVMYXN0Q2hhckNvZGVzKGNoYXJDb2RlID0+IHtcbiAgICAgICAgc3dpdGNoIChjaGFyQ29kZSkge1xuICAgICAgICAgIGNhc2UgQ0hBUlMuTkVXX0xJTkU6XG4gICAgICAgICAgICBpZiAoZm91bmROZXdMaW5lKSB7XG4gICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGZvdW5kTmV3TGluZSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIENIQVJTLkNBUlJJQUdFX1JFVFVSTjpcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgICAgY2FzZSBDSEFSUy5PUEVOX0JSQUNFOlxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBwcml2YXRlIF91cGRhdGVJbnRlcm5hbFN0YXRlKHN0cjogc3RyaW5nKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGN1cnJlbnRDaGFyID0gc3RyLmNoYXJDb2RlQXQoaSk7XG5cbiAgICAgIC8vIFRoaXMgaXMgYSBwZXJmb3JtYW5jZSBvcHRpbWl6YXRpb24gdG8gc2hvcnQgY2lyY3VpdCBhbGwgdGhlIGNoZWNrcyBiZWxvdy4gSWYgdGhlIGN1cnJlbnQgY2hhclxuICAgICAgLy8gaXMgbm90IGluIHRoaXMgc2V0IHRoZW4gaXQgd29uJ3QgY2hhbmdlIGFueSBpbnRlcm5hbCBzdGF0ZSBzbyBubyBuZWVkIHRvIGNvbnRpbnVlIGFuZCBkb1xuICAgICAgLy8gc28gbWFueSBvdGhlciBjaGVja3MgKHRoaXMgbWFkZSBpdCAzeCBmYXN0ZXIgaW4gb25lIHNjZW5hcmlvIEkgdGVzdGVkKS5cbiAgICAgIGlmICghaXNDaGFyVG9IYW5kbGUuaGFzKGN1cnJlbnRDaGFyKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcGFzdENoYXIgPSBpID09PSAwID8gdGhpcy5fZ2V0TGFzdENoYXJDb2RlV2l0aE9mZnNldCgwKSA6IHN0ci5jaGFyQ29kZUF0KGkgLSAxKTtcbiAgICAgIGNvbnN0IHBhc3RQYXN0Q2hhciA9IGkgPT09IDAgPyB0aGlzLl9nZXRMYXN0Q2hhckNvZGVXaXRoT2Zmc2V0KDEpIDogaSA9PT0gMSA/IHRoaXMuX2dldExhc3RDaGFyQ29kZVdpdGhPZmZzZXQoMCkgOiBzdHIuY2hhckNvZGVBdChpIC0gMik7XG5cbiAgICAgIC8vIGhhbmRsZSByZWdleFxuICAgICAgaWYgKHRoaXMuX2lzSW5SZWdFeCkge1xuICAgICAgICBpZiAocGFzdENoYXIgPT09IENIQVJTLkZPUldBUkRfU0xBU0ggJiYgcGFzdFBhc3RDaGFyICE9PSBDSEFSUy5CQUNLX1NMQVNIIHx8IHBhc3RDaGFyID09PSBDSEFSUy5ORVdfTElORSkge1xuICAgICAgICAgIHRoaXMuX2lzSW5SZWdFeCA9IGZhbHNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKCF0aGlzLmlzSW5TdHJpbmcoKSAmJiAhdGhpcy5pc0luQ29tbWVudCgpICYmIGlzUmVnRXhTdGFydChjdXJyZW50Q2hhciwgcGFzdENoYXIsIHBhc3RQYXN0Q2hhcikpIHtcbiAgICAgICAgdGhpcy5faXNJblJlZ0V4ID0gdHJ1ZTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIGhhbmRsZSBjb21tZW50c1xuICAgICAgaWYgKHRoaXMuX2N1cnJlbnRDb21tZW50Q2hhciA9PSBudWxsICYmIHBhc3RDaGFyID09PSBDSEFSUy5GT1JXQVJEX1NMQVNIICYmIGN1cnJlbnRDaGFyID09PSBDSEFSUy5GT1JXQVJEX1NMQVNIKSB7XG4gICAgICAgIHRoaXMuX2N1cnJlbnRDb21tZW50Q2hhciA9IENvbW1lbnRDaGFyLkxpbmU7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX2N1cnJlbnRDb21tZW50Q2hhciA9PSBudWxsICYmIHBhc3RDaGFyID09PSBDSEFSUy5GT1JXQVJEX1NMQVNIICYmIGN1cnJlbnRDaGFyID09PSBDSEFSUy5BU1RFUklTSykge1xuICAgICAgICB0aGlzLl9jdXJyZW50Q29tbWVudENoYXIgPSBDb21tZW50Q2hhci5TdGFyO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl9jdXJyZW50Q29tbWVudENoYXIgPT09IENvbW1lbnRDaGFyLlN0YXIgJiYgcGFzdENoYXIgPT09IENIQVJTLkFTVEVSSVNLICYmIGN1cnJlbnRDaGFyID09PSBDSEFSUy5GT1JXQVJEX1NMQVNIKSB7XG4gICAgICAgIHRoaXMuX2N1cnJlbnRDb21tZW50Q2hhciA9IHVuZGVmaW5lZDtcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuaXNJbkNvbW1lbnQoKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gaGFuZGxlIHN0cmluZ3NcbiAgICAgIGNvbnN0IGxhc3RTdHJpbmdDaGFyT25TdGFjayA9IHRoaXMuX3N0cmluZ0NoYXJTdGFjay5sZW5ndGggPT09IDAgPyB1bmRlZmluZWQgOiB0aGlzLl9zdHJpbmdDaGFyU3RhY2tbdGhpcy5fc3RyaW5nQ2hhclN0YWNrLmxlbmd0aCAtIDFdO1xuICAgICAgaWYgKHBhc3RDaGFyICE9PSBDSEFSUy5CQUNLX1NMQVNIICYmIChjdXJyZW50Q2hhciA9PT0gQ0hBUlMuRE9VQkxFX1FVT1RFIHx8IGN1cnJlbnRDaGFyID09PSBDSEFSUy5TSU5HTEVfUVVPVEUgfHwgY3VycmVudENoYXIgPT09IENIQVJTLkJBQ0tfVElDSykpIHtcbiAgICAgICAgaWYgKGxhc3RTdHJpbmdDaGFyT25TdGFjayA9PT0gY3VycmVudENoYXIpIHtcbiAgICAgICAgICB0aGlzLl9zdHJpbmdDaGFyU3RhY2sucG9wKCk7XG4gICAgICAgIH0gZWxzZSBpZiAobGFzdFN0cmluZ0NoYXJPblN0YWNrID09PSBDSEFSUy5PUEVOX0JSQUNFIHx8IGxhc3RTdHJpbmdDaGFyT25TdGFjayA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgdGhpcy5fc3RyaW5nQ2hhclN0YWNrLnB1c2goY3VycmVudENoYXIpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHBhc3RQYXN0Q2hhciAhPT0gQ0hBUlMuQkFDS19TTEFTSCAmJiBwYXN0Q2hhciA9PT0gQ0hBUlMuRE9MTEFSX1NJR04gJiYgY3VycmVudENoYXIgPT09IENIQVJTLk9QRU5fQlJBQ0UgJiYgbGFzdFN0cmluZ0NoYXJPblN0YWNrID09PSBDSEFSUy5CQUNLX1RJQ0spIHtcbiAgICAgICAgdGhpcy5fc3RyaW5nQ2hhclN0YWNrLnB1c2goY3VycmVudENoYXIpO1xuICAgICAgfSBlbHNlIGlmIChjdXJyZW50Q2hhciA9PT0gQ0hBUlMuQ0xPU0VfQlJBQ0UgJiYgbGFzdFN0cmluZ0NoYXJPblN0YWNrID09PSBDSEFSUy5PUEVOX0JSQUNFKSB7XG4gICAgICAgIHRoaXMuX3N0cmluZ0NoYXJTdGFjay5wb3AoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKiogQGludGVybmFsIC0gVGhpcyBpcyBwcml2YXRlLCBidXQgZXhwb3NlZCBmb3IgdGVzdGluZy4gKi9cbiAgX2dldExhc3RDaGFyQ29kZVdpdGhPZmZzZXQob2Zmc2V0OiBudW1iZXIpIHtcbiAgICBpZiAob2Zmc2V0ID49IHRoaXMuX2xlbmd0aCB8fCBvZmZzZXQgPCAwKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGZvciAobGV0IGkgPSB0aGlzLl90ZXh0cy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgY29uc3QgY3VycmVudFRleHQgPSB0aGlzLl90ZXh0c1tpXTtcbiAgICAgIGlmIChvZmZzZXQgPj0gY3VycmVudFRleHQubGVuZ3RoKSB7XG4gICAgICAgIG9mZnNldCAtPSBjdXJyZW50VGV4dC5sZW5ndGg7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gY3VycmVudFRleHQuY2hhckNvZGVBdChjdXJyZW50VGV4dC5sZW5ndGggLSAxIC0gb2Zmc2V0KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgcHJpdmF0ZSBfd3JpdGVJbmRlbnRhdGlvbigpIHtcbiAgICBjb25zdCBmbG9vcmVkSW5kZW50YXRpb24gPSBNYXRoLmZsb29yKHRoaXMuX2N1cnJlbnRJbmRlbnRhdGlvbik7XG4gICAgdGhpcy5faW50ZXJuYWxXcml0ZSh0aGlzLl9pbmRlbnRhdGlvblRleHQucmVwZWF0KGZsb29yZWRJbmRlbnRhdGlvbikpO1xuXG4gICAgY29uc3Qgb3ZlcmZsb3cgPSB0aGlzLl9jdXJyZW50SW5kZW50YXRpb24gLSBmbG9vcmVkSW5kZW50YXRpb247XG4gICAgaWYgKHRoaXMuX3VzZVRhYnMpIHtcbiAgICAgIGlmIChvdmVyZmxvdyA+IDAuNSkge1xuICAgICAgICB0aGlzLl9pbnRlcm5hbFdyaXRlKHRoaXMuX2luZGVudGF0aW9uVGV4dCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHBvcnRpb24gPSBNYXRoLnJvdW5kKHRoaXMuX2luZGVudGF0aW9uVGV4dC5sZW5ndGggKiBvdmVyZmxvdyk7XG5cbiAgICAgIC8vIGJ1aWxkIHVwIHRoZSBzdHJpbmcgZmlyc3QsIHRoZW4gYXBwZW5kIGl0IGZvciBwZXJmb3JtYW5jZSByZWFzb25zXG4gICAgICBsZXQgdGV4dCA9IFwiXCI7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBvcnRpb247IGkrKykge1xuICAgICAgICB0ZXh0ICs9IHRoaXMuX2luZGVudGF0aW9uVGV4dFtpXTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2ludGVybmFsV3JpdGUodGV4dCk7XG4gICAgfVxuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBwcml2YXRlIF9uZXdMaW5lSWZOZXdMaW5lT25OZXh0V3JpdGUoKSB7XG4gICAgaWYgKCF0aGlzLl9uZXdMaW5lT25OZXh0V3JpdGUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5fbmV3TGluZU9uTmV4dFdyaXRlID0gZmFsc2U7XG4gICAgdGhpcy5uZXdMaW5lKCk7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIHByaXZhdGUgX2ludGVybmFsV3JpdGUodGV4dDogc3RyaW5nKSB7XG4gICAgaWYgKHRleHQubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5fdGV4dHMucHVzaCh0ZXh0KTtcbiAgICB0aGlzLl9sZW5ndGggKz0gdGV4dC5sZW5ndGg7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IF9zcGFjZXNPclRhYnNSZWdFeCA9IC9eWyBcXHRdKiQvO1xuICAvKiogQGludGVybmFsICovXG4gIHByaXZhdGUgX2dldEluZGVudGF0aW9uTGV2ZWxGcm9tQXJnKGNvdW50T3JUZXh0OiBzdHJpbmcgfCBudW1iZXIpIHtcbiAgICBpZiAodHlwZW9mIGNvdW50T3JUZXh0ID09PSBcIm51bWJlclwiKSB7XG4gICAgICBpZiAoY291bnRPclRleHQgPCAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIlBhc3NlZCBpbiBpbmRlbnRhdGlvbiBsZXZlbCBzaG91bGQgYmUgZ3JlYXRlciB0aGFuIG9yIGVxdWFsIHRvIDAuXCIpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGNvdW50T3JUZXh0O1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGNvdW50T3JUZXh0ID09PSBcInN0cmluZ1wiKSB7XG4gICAgICBpZiAoIUNvZGVCbG9ja1dyaXRlci5fc3BhY2VzT3JUYWJzUmVnRXgudGVzdChjb3VudE9yVGV4dCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiUHJvdmlkZWQgc3RyaW5nIG11c3QgYmUgZW1wdHkgb3Igb25seSBjb250YWluIHNwYWNlcyBvciB0YWJzLlwiKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgeyBzcGFjZXNDb3VudCwgdGFic0NvdW50IH0gPSBnZXRTcGFjZXNBbmRUYWJzQ291bnQoY291bnRPclRleHQpO1xuICAgICAgcmV0dXJuIHRhYnNDb3VudCArIHNwYWNlc0NvdW50IC8gdGhpcy5faW5kZW50TnVtYmVyT2ZTcGFjZXM7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkFyZ3VtZW50IHByb3ZpZGVkIG11c3QgYmUgYSBzdHJpbmcgb3IgbnVtYmVyLlwiKTtcbiAgICB9XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIHByaXZhdGUgX3NldEluZGVudGF0aW9uU3RhdGUoc3RhdGU6IEluZGVudGF0aW9uTGV2ZWxTdGF0ZSkge1xuICAgIHRoaXMuX2N1cnJlbnRJbmRlbnRhdGlvbiA9IHN0YXRlLmN1cnJlbnQ7XG4gICAgdGhpcy5fcXVldWVkSW5kZW50YXRpb24gPSBzdGF0ZS5xdWV1ZWQ7XG4gICAgdGhpcy5fcXVldWVkT25seUlmTm90QmxvY2sgPSBzdGF0ZS5xdWV1ZWRPbmx5SWZOb3RCbG9jaztcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgcHJpdmF0ZSBfZ2V0SW5kZW50YXRpb25TdGF0ZSgpOiBJbmRlbnRhdGlvbkxldmVsU3RhdGUge1xuICAgIHJldHVybiB7XG4gICAgICBjdXJyZW50OiB0aGlzLl9jdXJyZW50SW5kZW50YXRpb24sXG4gICAgICBxdWV1ZWQ6IHRoaXMuX3F1ZXVlZEluZGVudGF0aW9uLFxuICAgICAgcXVldWVkT25seUlmTm90QmxvY2s6IHRoaXMuX3F1ZXVlZE9ubHlJZk5vdEJsb2NrLFxuICAgIH07XG4gIH1cbn1cblxuaW50ZXJmYWNlIEluZGVudGF0aW9uTGV2ZWxTdGF0ZSB7XG4gIGN1cnJlbnQ6IG51bWJlcjtcbiAgcXVldWVkOiBudW1iZXIgfCB1bmRlZmluZWQ7XG4gIHF1ZXVlZE9ubHlJZk5vdEJsb2NrOiB0cnVlIHwgdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBpc1JlZ0V4U3RhcnQoY3VycmVudENoYXI6IG51bWJlciwgcGFzdENoYXI6IG51bWJlciB8IHVuZGVmaW5lZCwgcGFzdFBhc3RDaGFyOiBudW1iZXIgfCB1bmRlZmluZWQpIHtcbiAgcmV0dXJuIHBhc3RDaGFyID09PSBDSEFSUy5GT1JXQVJEX1NMQVNIXG4gICAgJiYgY3VycmVudENoYXIgIT09IENIQVJTLkZPUldBUkRfU0xBU0hcbiAgICAmJiBjdXJyZW50Q2hhciAhPT0gQ0hBUlMuQVNURVJJU0tcbiAgICAmJiBwYXN0UGFzdENoYXIgIT09IENIQVJTLkFTVEVSSVNLXG4gICAgJiYgcGFzdFBhc3RDaGFyICE9PSBDSEFSUy5GT1JXQVJEX1NMQVNIO1xufVxuXG5mdW5jdGlvbiBnZXRJbmRlbnRhdGlvblRleHQodXNlVGFiczogYm9vbGVhbiwgbnVtYmVyU3BhY2VzOiBudW1iZXIpIHtcbiAgaWYgKHVzZVRhYnMpIHtcbiAgICByZXR1cm4gXCJcXHRcIjtcbiAgfVxuICByZXR1cm4gQXJyYXkobnVtYmVyU3BhY2VzICsgMSkuam9pbihcIiBcIik7XG59XG5cbmZ1bmN0aW9uIGdldFNwYWNlc0FuZFRhYnNDb3VudChzdHI6IHN0cmluZykge1xuICBsZXQgc3BhY2VzQ291bnQgPSAwO1xuICBsZXQgdGFic0NvdW50ID0gMDtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGNoYXJDb2RlID0gc3RyLmNoYXJDb2RlQXQoaSk7XG4gICAgaWYgKGNoYXJDb2RlID09PSBDSEFSUy5TUEFDRSkge1xuICAgICAgc3BhY2VzQ291bnQrKztcbiAgICB9IGVsc2UgaWYgKGNoYXJDb2RlID09PSBDSEFSUy5UQUIpIHtcbiAgICAgIHRhYnNDb3VudCsrO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7IHNwYWNlc0NvdW50LCB0YWJzQ291bnQgfTtc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