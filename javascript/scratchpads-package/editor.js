var Editor = function(id) {
    var editor = this;

    id = id || "editor";

    this.editorElem = $("#" + id);

    editor.editor = ace.edit(id);

    editor.editor.setHighlightActiveLine(false);

    // Stop bracket highlighting
    editor.editor.$highlightBrackets = function() {};

    // Make sure no horizontal scrollbars are shown
    editor.editor.renderer.setHScrollBarAlwaysVisible(false);

    var session = editor.editor.getSession();

    // Use word wrap
    session.setUseWrapMode(true);

    // Use soft tabs
    session.setUseSoftTabs(true);

    // Stop automatic JSHINT warnings
    session.setUseWorker(false);

    // Use JavaScript Mode
    session.setMode(new (require("ace/mode/javascript").Mode)());

    editor.editor.setTheme("ace/theme/textmate");

    editor.textarea = editor.editorElem.find("textarea");
    editor.content = editor.editorElem.find("div.ace_content");

    editor.offset = editor.content.offset();

    if (window.Record) {
        var canon = require("pilot/canon"),
            event = require("pilot/event"),
            paste = false,
            doSelect = true;

        function blockSelection() {
            doSelect = false;

            setTimeout(function() {
                doSelect = true;
            }, 13);
        }

        editor.editor.keyBinding.setKeyboardHandler({
            handleKeyboard: function($data, hashId, keyOrText, keyCode, e) {
                if (!Record.recording) {
                    return;
                }

                var isCommand = canon.findKeyCommand({editor: editor.editor}, "editor", hashId, keyOrText),
                    isEmpty = $.isEmptyObject(e);

                if (isCommand && !isEmpty) {
                    Record.log({ cmd: isCommand.name });
                    blockSelection();

                    // Prevent commands from having any logged side effects
                    var oldExec = isCommand.exec;

                    isCommand.exec = function() {
                        Record.recording = false;
                        var ret = oldExec.apply(this, arguments);
                        Record.recording = true;
                        return ret;
                    };

                    return isCommand;

                } else if (!isCommand && isEmpty) {
                    if (!paste) {
                        Record.log({ key: keyOrText });
                    }
                    blockSelection();
                    paste = false;
                }
            }
        });

        editor.editor.addEventListener("copy", function() {
            Record.log({ copy: 1 });
        });

        editor.editor.addEventListener("paste", function(text) {
            if (Record.recording) {
                paste = true;
                Record.log({ paste: text });
            }
        });

        editor.editor.addEventListener("cut", function() {
            Record.log({ cut: 1 });
            blockSelection();
        });

        editor.editor.renderer.scrollBar.addEventListener("scroll", function(e) {
            Record.log({ top: e.data });
        });

        var curRange;

        var handleSelect = function() {
            if (!doSelect || !Record.recording) {
                return;
            }

            if (!curRange) {
                setTimeout(function() {
                    var diff = {
                        start: {
                            row: curRange.start.row,
                            column: curRange.start.column
                        }
                    };

                    if (curRange.end.row !== curRange.start.row ||
                         curRange.end.column !== curRange.start.column) {

                        diff.end = {
                            row: curRange.end.row,
                            column: curRange.end.column
                        };
                    }

                    var lastSelection = Record.commands[Record.commands.length - 1];

                    // Note: Not sure how I feel about using JSON.stringify for deep comparisons
                    //       but boy is it convenient.
                    if (lastSelection) {
                        lastSelection = JSON.stringify({ start: lastSelection.start, end: lastSelection.end });
                    }

                    if (!lastSelection || lastSelection !== JSON.stringify(diff)) {
                        Record.log(diff);
                    }

                    curRange = null;
                }, 13);
            }

            curRange = editor.editor.selection.getRange();
        };

        editor.editor.selection.addEventListener("changeCursor", function() {
            if (editor.editor.selection.isEmpty()) {
                handleSelect();
            }
        });

        editor.editor.selection.addEventListener("changeSelection", handleSelect);

        // Add in record playback handlers.
        $.extend(Record.handlers, {
            cut: function() {
                editor.editor.onCut();
            },

            copy: function() {
                editor.editor.getCopyText();
            },

            paste: function(e) {
                editor.editor.onTextInput(e.paste, true);
            },

            cmd: function(e) {
                canon.exec(e.cmd, { editor: editor.editor }, "editor");
            },

            key: function(e) {
                editor.editor.onTextInput(e.key, false);
            },

            top: function(e) {
                editor.editor.renderer.scrollBar.setScrollTop(e.top);
            },

            start: function(e) {
                if (!e.end) {
                    e.end = e.start;
                }

                editor.editor.selection.setSelectionRange(e);
            },

            focus: function() {
                editor.textarea[0].focus();
            }
        });
    }

    editor.reset();
};

// TODO(jlfwong): Move this into ScratchpadUI
Editor.reset = function() {
    var scratchpad = ScratchpadUI.scratchpad;
    $("#editor").editorText(scratchpad.get("revision").get("code") || "");
};

Editor.prototype = {
    reset: function() {
        this.loadCode("");
    },

    loadCode: function(code) {
        this.editor.getSession().setValue(code);
    }
};

/*
 * Utility plugins for working with the editor
 */

// Focus the editor
window.focusEditor = function() {
    $("#editor").data("editor").editor.focus();
};

// Set the cursor position on the editor
window.setCursor = function(cursor) {
    $("#editor").setCursor(cursor);
};

$.fn.editorText = function(text) {
    var editor = this.data("editor");

    if (text != null) {
        if (editor && editor.editor) {
            editor.editor.getSession().setValue(text);
        }

    } else {
        return editor && editor.editor ?
            editor.editor.getSession().getValue().replace(/\r/g, "\n") :
            null;
    }

    return this;
};

$.fn.getCursor = function() {
    return this.data("editor").editor.getCursorPosition();
};

$.fn.setCursor = function(cursorPos, focus) {
    var editor = this.data("editor");

    editor.editor.moveCursorToPosition(cursorPos);

    editor.editor.clearSelection();

    if (focus !== false) {
        editor.editor.focus();
    }
};
