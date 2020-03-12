// Created with Squiffy 5.1.3
// https://github.com/textadventures/squiffy

(function(){
/* jshint quotmark: single */
/* jshint evil: true */

var squiffy = {};

(function () {
    'use strict';

    squiffy.story = {};

    var initLinkHandler = function () {
        var handleLink = function (link) {
            if (link.hasClass('disabled')) return;
            var passage = link.data('passage');
            var section = link.data('section');
            var rotateAttr = link.attr('data-rotate');
            var sequenceAttr = link.attr('data-sequence');
            if (passage) {
                disableLink(link);
                squiffy.set('_turncount', squiffy.get('_turncount') + 1);
                passage = processLink(passage);
                if (passage) {
                    currentSection.append('<hr/>');
                    squiffy.story.passage(passage);
                }
                var turnPassage = '@' + squiffy.get('_turncount');
                if (turnPassage in squiffy.story.section.passages) {
                    squiffy.story.passage(turnPassage);
                }
                if ('@last' in squiffy.story.section.passages && squiffy.get('_turncount')>= squiffy.story.section.passageCount) {
                    squiffy.story.passage('@last');
                }
            }
            else if (section) {
                currentSection.append('<hr/>');
                disableLink(link);
                section = processLink(section);
                squiffy.story.go(section);
            }
            else if (rotateAttr || sequenceAttr) {
                var result = rotate(rotateAttr || sequenceAttr, rotateAttr ? link.text() : '');
                link.html(result[0].replace(/&quot;/g, '"').replace(/&#39;/g, '\''));
                var dataAttribute = rotateAttr ? 'data-rotate' : 'data-sequence';
                link.attr(dataAttribute, result[1]);
                if (!result[1]) {
                    disableLink(link);
                }
                if (link.attr('data-attribute')) {
                    squiffy.set(link.attr('data-attribute'), result[0]);
                }
                squiffy.story.save();
            }
        };

        squiffy.ui.output.on('click', 'a.squiffy-link', function () {
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('keypress', 'a.squiffy-link', function (e) {
            if (e.which !== 13) return;
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('mousedown', 'a.squiffy-link', function (event) {
            event.preventDefault();
        });
    };

    var disableLink = function (link) {
        link.addClass('disabled');
        link.attr('tabindex', -1);
    }
    
    squiffy.story.begin = function () {
        if (!squiffy.story.load()) {
            squiffy.story.go(squiffy.story.start);
        }
    };

    var processLink = function(link) {
		link = String(link);
        var sections = link.split(',');
        var first = true;
        var target = null;
        sections.forEach(function (section) {
            section = section.trim();
            if (startsWith(section, '@replace ')) {
                replaceLabel(section.substring(9));
            }
            else {
                if (first) {
                    target = section;
                }
                else {
                    setAttribute(section);
                }
            }
            first = false;
        });
        return target;
    };

    var setAttribute = function(expr) {
        var lhs, rhs, op, value;
        var setRegex = /^([\w]*)\s*=\s*(.*)$/;
        var setMatch = setRegex.exec(expr);
        if (setMatch) {
            lhs = setMatch[1];
            rhs = setMatch[2];
            if (isNaN(rhs)) {
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
                squiffy.set(lhs, rhs);
            }
            else {
                squiffy.set(lhs, parseFloat(rhs));
            }
        }
        else {
			var incDecRegex = /^([\w]*)\s*([\+\-\*\/])=\s*(.*)$/;
            var incDecMatch = incDecRegex.exec(expr);
            if (incDecMatch) {
                lhs = incDecMatch[1];
                op = incDecMatch[2];
				rhs = incDecMatch[3];
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
				rhs = parseFloat(rhs);
                value = squiffy.get(lhs);
                if (value === null) value = 0;
                if (op == '+') {
                    value += rhs;
                }
                if (op == '-') {
                    value -= rhs;
                }
				if (op == '*') {
					value *= rhs;
				}
				if (op == '/') {
					value /= rhs;
				}
                squiffy.set(lhs, value);
            }
            else {
                value = true;
                if (startsWith(expr, 'not ')) {
                    expr = expr.substring(4);
                    value = false;
                }
                squiffy.set(expr, value);
            }
        }
    };

    var replaceLabel = function(expr) {
        var regex = /^([\w]*)\s*=\s*(.*)$/;
        var match = regex.exec(expr);
        if (!match) return;
        var label = match[1];
        var text = match[2];
        if (text in squiffy.story.section.passages) {
            text = squiffy.story.section.passages[text].text;
        }
        else if (text in squiffy.story.sections) {
            text = squiffy.story.sections[text].text;
        }
        var stripParags = /^<p>(.*)<\/p>$/;
        var stripParagsMatch = stripParags.exec(text);
        if (stripParagsMatch) {
            text = stripParagsMatch[1];
        }
        var $labels = squiffy.ui.output.find('.squiffy-label-' + label);
        $labels.fadeOut(1000, function() {
            $labels.html(squiffy.ui.processText(text));
            $labels.fadeIn(1000, function() {
                squiffy.story.save();
            });
        });
    };

    squiffy.story.go = function(section) {
        squiffy.set('_transition', null);
        newSection();
        squiffy.story.section = squiffy.story.sections[section];
        if (!squiffy.story.section) return;
        squiffy.set('_section', section);
        setSeen(section);
        var master = squiffy.story.sections[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(squiffy.story.section);
        // The JS might have changed which section we're in
        if (squiffy.get('_section') == section) {
            squiffy.set('_turncount', 0);
            squiffy.ui.write(squiffy.story.section.text);
            squiffy.story.save();
        }
    };

    squiffy.story.run = function(section) {
        if (section.clear) {
            squiffy.ui.clearScreen();
        }
        if (section.attributes) {
            processAttributes(section.attributes);
        }
        if (section.js) {
            section.js();
        }
    };

    squiffy.story.passage = function(passageName) {
        var passage = squiffy.story.section.passages[passageName];
        if (!passage) return;
        setSeen(passageName);
        var masterSection = squiffy.story.sections[''];
        if (masterSection) {
            var masterPassage = masterSection.passages[''];
            if (masterPassage) {
                squiffy.story.run(masterPassage);
                squiffy.ui.write(masterPassage.text);
            }
        }
        var master = squiffy.story.section.passages[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(passage);
        squiffy.ui.write(passage.text);
        squiffy.story.save();
    };

    var processAttributes = function(attributes) {
        attributes.forEach(function (attribute) {
            if (startsWith(attribute, '@replace ')) {
                replaceLabel(attribute.substring(9));
            }
            else {
                setAttribute(attribute);
            }
        });
    };

    squiffy.story.restart = function() {
        if (squiffy.ui.settings.persist && window.localStorage) {
            var keys = Object.keys(localStorage);
            jQuery.each(keys, function (idx, key) {
                if (startsWith(key, squiffy.story.id)) {
                    localStorage.removeItem(key);
                }
            });
        }
        else {
            squiffy.storageFallback = {};
        }
        if (squiffy.ui.settings.scroll === 'element') {
            squiffy.ui.output.html('');
            squiffy.story.begin();
        }
        else {
            location.reload();
        }
    };

    squiffy.story.save = function() {
        squiffy.set('_output', squiffy.ui.output.html());
    };

    squiffy.story.load = function() {
        var output = squiffy.get('_output');
        if (!output) return false;
        squiffy.ui.output.html(output);
        currentSection = jQuery('#' + squiffy.get('_output-section'));
        squiffy.story.section = squiffy.story.sections[squiffy.get('_section')];
        var transition = squiffy.get('_transition');
        if (transition) {
            eval('(' + transition + ')()');
        }
        return true;
    };

    var setSeen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) seenSections = [];
        if (seenSections.indexOf(sectionName) == -1) {
            seenSections.push(sectionName);
            squiffy.set('_seen_sections', seenSections);
        }
    };

    squiffy.story.seen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) return false;
        return (seenSections.indexOf(sectionName) > -1);
    };
    
    squiffy.ui = {};

    var currentSection = null;
    var screenIsClear = true;
    var scrollPosition = 0;

    var newSection = function() {
        if (currentSection) {
            disableLink(jQuery('.squiffy-link', currentSection));
        }
        var sectionCount = squiffy.get('_section-count') + 1;
        squiffy.set('_section-count', sectionCount);
        var id = 'squiffy-section-' + sectionCount;
        currentSection = jQuery('<div/>', {
            id: id,
        }).appendTo(squiffy.ui.output);
        squiffy.set('_output-section', id);
    };

    squiffy.ui.write = function(text) {
        screenIsClear = false;
        scrollPosition = squiffy.ui.output.height();
        currentSection.append(jQuery('<div/>').html(squiffy.ui.processText(text)));
        squiffy.ui.scrollToEnd();
    };

    squiffy.ui.clearScreen = function() {
        squiffy.ui.output.html('');
        screenIsClear = true;
        newSection();
    };

    squiffy.ui.scrollToEnd = function() {
        var scrollTo, currentScrollTop, distance, duration;
        if (squiffy.ui.settings.scroll === 'element') {
            scrollTo = squiffy.ui.output[0].scrollHeight - squiffy.ui.output.height();
            currentScrollTop = squiffy.ui.output.scrollTop();
            if (scrollTo > currentScrollTop) {
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.4;
                squiffy.ui.output.stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
        else {
            scrollTo = scrollPosition;
            currentScrollTop = Math.max(jQuery('body').scrollTop(), jQuery('html').scrollTop());
            if (scrollTo > currentScrollTop) {
                var maxScrollTop = jQuery(document).height() - jQuery(window).height();
                if (scrollTo > maxScrollTop) scrollTo = maxScrollTop;
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.5;
                jQuery('body,html').stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
    };

    squiffy.ui.processText = function(text) {
        function process(text, data) {
            var containsUnprocessedSection = false;
            var open = text.indexOf('{');
            var close;
            
            if (open > -1) {
                var nestCount = 1;
                var searchStart = open + 1;
                var finished = false;
             
                while (!finished) {
                    var nextOpen = text.indexOf('{', searchStart);
                    var nextClose = text.indexOf('}', searchStart);
         
                    if (nextClose > -1) {
                        if (nextOpen > -1 && nextOpen < nextClose) {
                            nestCount++;
                            searchStart = nextOpen + 1;
                        }
                        else {
                            nestCount--;
                            searchStart = nextClose + 1;
                            if (nestCount === 0) {
                                close = nextClose;
                                containsUnprocessedSection = true;
                                finished = true;
                            }
                        }
                    }
                    else {
                        finished = true;
                    }
                }
            }
            
            if (containsUnprocessedSection) {
                var section = text.substring(open + 1, close);
                var value = processTextCommand(section, data);
                text = text.substring(0, open) + value + process(text.substring(close + 1), data);
            }
            
            return (text);
        }

        function processTextCommand(text, data) {
            if (startsWith(text, 'if ')) {
                return processTextCommand_If(text, data);
            }
            else if (startsWith(text, 'else:')) {
                return processTextCommand_Else(text, data);
            }
            else if (startsWith(text, 'label:')) {
                return processTextCommand_Label(text, data);
            }
            else if (/^rotate[: ]/.test(text)) {
                return processTextCommand_Rotate('rotate', text, data);
            }
            else if (/^sequence[: ]/.test(text)) {
                return processTextCommand_Rotate('sequence', text, data);   
            }
            else if (text in squiffy.story.section.passages) {
                return process(squiffy.story.section.passages[text].text, data);
            }
            else if (text in squiffy.story.sections) {
                return process(squiffy.story.sections[text].text, data);
            }
			else if (startsWith(text,'@') && !startsWith(text,'@replace')) {
				processAttributes(text.substring(1).split(","));
				return "";
			}
            return squiffy.get(text);
        }

        function processTextCommand_If(section, data) {
            var command = section.substring(3);
            var colon = command.indexOf(':');
            if (colon == -1) {
                return ('{if ' + command + '}');
            }

            var text = command.substring(colon + 1);
            var condition = command.substring(0, colon);
			condition = condition.replace("<", "&lt;");
            var operatorRegex = /([\w ]*)(=|&lt;=|&gt;=|&lt;&gt;|&lt;|&gt;)(.*)/;
            var match = operatorRegex.exec(condition);

            var result = false;

            if (match) {
                var lhs = squiffy.get(match[1]);
                var op = match[2];
                var rhs = match[3];

				if(startsWith(rhs,'@')) rhs=squiffy.get(rhs.substring(1));
				
                if (op == '=' && lhs == rhs) result = true;
                if (op == '&lt;&gt;' && lhs != rhs) result = true;
                if (op == '&gt;' && lhs > rhs) result = true;
                if (op == '&lt;' && lhs < rhs) result = true;
                if (op == '&gt;=' && lhs >= rhs) result = true;
                if (op == '&lt;=' && lhs <= rhs) result = true;
            }
            else {
                var checkValue = true;
                if (startsWith(condition, 'not ')) {
                    condition = condition.substring(4);
                    checkValue = false;
                }

                if (startsWith(condition, 'seen ')) {
                    result = (squiffy.story.seen(condition.substring(5)) == checkValue);
                }
                else {
                    var value = squiffy.get(condition);
                    if (value === null) value = false;
                    result = (value == checkValue);
                }
            }

            var textResult = result ? process(text, data) : '';

            data.lastIf = result;
            return textResult;
        }

        function processTextCommand_Else(section, data) {
            if (!('lastIf' in data) || data.lastIf) return '';
            var text = section.substring(5);
            return process(text, data);
        }

        function processTextCommand_Label(section, data) {
            var command = section.substring(6);
            var eq = command.indexOf('=');
            if (eq == -1) {
                return ('{label:' + command + '}');
            }

            var text = command.substring(eq + 1);
            var label = command.substring(0, eq);

            return '<span class="squiffy-label-' + label + '">' + process(text, data) + '</span>';
        }

        function processTextCommand_Rotate(type, section, data) {
            var options;
            var attribute = '';
            if (section.substring(type.length, type.length + 1) == ' ') {
                var colon = section.indexOf(':');
                if (colon == -1) {
                    return '{' + section + '}';
                }
                options = section.substring(colon + 1);
                attribute = section.substring(type.length + 1, colon);
            }
            else {
                options = section.substring(type.length + 1);
            }
            var rotation = rotate(options.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
            if (attribute) {
                squiffy.set(attribute, rotation[0]);
            }
            return '<a class="squiffy-link" data-' + type + '="' + rotation[1] + '" data-attribute="' + attribute + '" role="link">' + rotation[0] + '</a>';
        }

        var data = {
            fulltext: text
        };
        return process(text, data);
    };

    squiffy.ui.transition = function(f) {
        squiffy.set('_transition', f.toString());
        f();
    };

    squiffy.storageFallback = {};

    squiffy.set = function(attribute, value) {
        if (typeof value === 'undefined') value = true;
        if (squiffy.ui.settings.persist && window.localStorage) {
            localStorage[squiffy.story.id + '-' + attribute] = JSON.stringify(value);
        }
        else {
            squiffy.storageFallback[attribute] = JSON.stringify(value);
        }
        squiffy.ui.settings.onSet(attribute, value);
    };

    squiffy.get = function(attribute) {
        var result;
        if (squiffy.ui.settings.persist && window.localStorage) {
            result = localStorage[squiffy.story.id + '-' + attribute];
        }
        else {
            result = squiffy.storageFallback[attribute];
        }
        if (!result) return null;
        return JSON.parse(result);
    };

    var startsWith = function(string, prefix) {
        return string.substring(0, prefix.length) === prefix;
    };

    var rotate = function(options, current) {
        var colon = options.indexOf(':');
        if (colon == -1) {
            return [options, current];
        }
        var next = options.substring(0, colon);
        var remaining = options.substring(colon + 1);
        if (current) remaining += ':' + current;
        return [next, remaining];
    };

    var methods = {
        init: function (options) {
            var settings = jQuery.extend({
                scroll: 'body',
                persist: true,
                restartPrompt: true,
                onSet: function (attribute, value) {}
            }, options);

            squiffy.ui.output = this;
            squiffy.ui.restart = jQuery(settings.restart);
            squiffy.ui.settings = settings;

            if (settings.scroll === 'element') {
                squiffy.ui.output.css('overflow-y', 'auto');
            }

            initLinkHandler();
            squiffy.story.begin();
            
            return this;
        },
        get: function (attribute) {
            return squiffy.get(attribute);
        },
        set: function (attribute, value) {
            squiffy.set(attribute, value);
        },
        restart: function () {
            if (!squiffy.ui.settings.restartPrompt || confirm('Are you sure you want to restart?')) {
                squiffy.story.restart();
            }
        }
    };

    jQuery.fn.squiffy = function (methodOrOptions) {
        if (methods[methodOrOptions]) {
            return methods[methodOrOptions]
                .apply(this, Array.prototype.slice.call(arguments, 1));
        }
        else if (typeof methodOrOptions === 'object' || ! methodOrOptions) {
            return methods.init.apply(this, arguments);
        } else {
            jQuery.error('Method ' +  methodOrOptions + ' does not exist');
        }
    };
})();

var get = squiffy.get;
var set = squiffy.set;


squiffy.story.start = '_default';
squiffy.story.id = '9d2459946b';
squiffy.story.sections = {
	'_default': {
		'text': "<p>Made by Pawel &amp; Roos <br> <br>\n<a class=\"squiffy-link link-section\" data-section=\"Start\" role=\"link\" tabindex=\"0\">Start</a> <br>\n<a class=\"squiffy-link link-section\" data-section=\"Tutorial\" role=\"link\" tabindex=\"0\">Tutorial</a> </p>",
		'passages': {
		},
	},
	'Tutorial': {
		'text': "<p>Each choice is represented by a <a class=\"squiffy-link link-section\" data-section=\"new section\" role=\"link\" tabindex=\"0\">new section</a>.</p>",
		'passages': {
		},
	},
	'new section': {
		'text': "<p>In addition to sections, This game has the concept of passages. These are sections of text that don&#39;t advance the story. For example, you can click this <a class=\"squiffy-link link-passage\" data-passage=\"passage link\" role=\"link\" tabindex=\"0\">passage link</a>, and this <a class=\"squiffy-link link-passage\" data-passage=\"other passage link\" role=\"link\" tabindex=\"0\">other passage link</a>, but the story won&#39;t advance until you click this <a class=\"squiffy-link link-section\" data-section=\"section link\" role=\"link\" tabindex=\"0\">section link</a>.</p>",
		'passages': {
			'passage link': {
				'text': "<p>This is the text for the first passage link.</p>",
			},
			'other passage link': {
				'text': "<p>This is the text for the second passage link.</p>",
			},
		},
	},
	'section link': {
		'text': "<p>When a new section appears, any unclicked passage links from the previous section are disabled.\n<a class=\"squiffy-link link-section\" data-section=\"Start\" role=\"link\" tabindex=\"0\">Let&#39;s start, shall we?</a></p>",
		'passages': {
		},
	},
	'Start': {
		'text': "<p>You decide to visit your local IKEA, as you need to buy a new table.\nDo you take the <a class=\"squiffy-link link-section\" data-section=\"car\" role=\"link\" tabindex=\"0\">car</a> or <a class=\"squiffy-link link-section\" data-section=\"bike\" role=\"link\" tabindex=\"0\">bike</a>?</p>",
		'passages': {
		},
	},
	'bike': {
		'text': "<p>You realise you can&#39;t transport a table on a bike?\n<br>\nFine, I&#39;ll take the  <a class=\"squiffy-link link-section\" data-section=\"car\" role=\"link\" tabindex=\"0\">car</a></p>",
		'passages': {
		},
	},
	'car': {
		'text': "<p>You take the car, drive a bit, and when you finally reach the IKEA, you pull into the parking lot and park it. You <a class=\"squiffy-link link-section\" data-section=\"go inside\" role=\"link\" tabindex=\"0\">go inside</a></p>",
		'passages': {
		},
	},
	'go inside': {
		'text': "<p>You go inside, and past the cash registers. You decide to <a class=\"squiffy-link link-passage\" data-passage=\"follow the signs\" role=\"link\" tabindex=\"0\">follow the signs</a> to the furniture section.</p>",
		'passages': {
			'follow the signs': {
				'text': "<p>You reach the furniture section, which table do you take? <br>\nThe <a class=\"squiffy-link link-section\" data-section=\"one, table=oak\" role=\"link\" tabindex=\"0\">oak</a> one would blend in in your living room nicely. <br>\nThe <a class=\"squiffy-link link-section\" data-section=\"one, table=birch\" role=\"link\" tabindex=\"0\">birch</a> one would fit in so well with the chairs.</p>",
			},
		},
	},
	'one': {
		'text': "<p>You decide to take the {table} one. Much nicer. So you write down the code that corresponds to it. <br> Do you go to the <a class=\"squiffy-link link-section\" data-section=\"registers\" role=\"link\" tabindex=\"0\">registers</a> or do you decide to <a class=\"squiffy-link link-section\" data-section=\"sit down\" role=\"link\" tabindex=\"0\">sit down</a></p>",
		'passages': {
		},
	},
	'registers': {
		'text': "<p>You try to backtrack your steps, only to go into the kitchen section.... <br>\nYou can&#39;t possibly be so bad with directions. Well, you can. You&#39;re you. <br>\nWell, you can probably <a class=\"squiffy-link link-section\" data-section=\"follow the signs to the exit\" role=\"link\" tabindex=\"0\">follow the signs to the exit</a></p>",
		'passages': {
		},
	},
	'follow the signs to the exit': {
		'text': "<p>You don&#39;t see any signs to the exit. Maybe you&#39;re not only bad with directions, but also blind. You <a class=\"squiffy-link link-section\" data-section=\"pick a direction\" role=\"link\" tabindex=\"0\">pick a direction</a> and start walking, or you <a class=\"squiffy-link link-section\" data-section=\"sit down\" role=\"link\" tabindex=\"0\">sit down</a> on a kitchen counter.</p>",
		'passages': {
		},
	},
	'pick a direction': {
		'text': "<p>You take a direction, and decide to start walking till you either <a class=\"squiffy-link link-section\" data-section=\"find someone\" role=\"link\" tabindex=\"0\">find someone</a>, <a class=\"squiffy-link link-passage\" data-passage=\"find the exit\" role=\"link\" tabindex=\"0\">find the exit</a>, or <a class=\"squiffy-link link-passage\" data-passage=\"hit a wall\" role=\"link\" tabindex=\"0\">hit a wall</a>.</p>",
		'passages': {
			'find the exit': {
				'text': "<p>You didn&#39;t find one yet... <br>\nYou&#39;ve been walking for suprisingly long though...</p>",
			},
			'hit a wall': {
				'text': "<p>If you didn&#39;t have a fitness app on your phone, you would swear you were going crazy. GPS doesn&#39;t work properly, but it can track your location. You have walked 4 kilometers in, more or less, one line. No wall yet. You we&#39;re a bit unnerved, but now you&#39;re full-blown <b>panicking</b></p>",
			},
		},
	},
	'find someone': {
		'text': "<p>You saw someone walk in the distance, and swallowing your fatigue, you sprinted all the way.<br>\nYou thought it was a staff member at first - it was wearing the uniform. And hell maybe it was, maybe freakish 7ft tall monsters with long arms, short legs and no faces are just the kinds of thing they want working at IKEA. <br>\n<img src=\"https://i.imgur.com/qqBBkdY.png\" alt=\"ImageTitle\"> <br>\nShould you <a class=\"squiffy-link link-section\" data-section=\"Flee\" role=\"link\" tabindex=\"0\">run away as fast as possible</a> or try and <a class=\"squiffy-link link-section\" data-section=\"talk1\" role=\"link\" tabindex=\"0\">have a nice little chat with the staffmember</a></p>",
		'passages': {
		},
	},
	'follow3008': {
		'text': "<p>You follow it from a save distance. It will lead you somewhere, hopefully.<br>\nFollowing it...<br>\nFollowing it...<br>\nFollowing it...<br>\n<b>Snap.</b> <br>\nThe light went out. Scared the heebeegeebees of you. <br>\nEven though its dark, you can still make you the monster. <br>\nDo you <a class=\"squiffy-link link-section\" data-section=\"death1\" role=\"link\" tabindex=\"0\">still follow the monster</a> or <a class=\"squiffy-link link-section\" data-section=\"day2a\" role=\"link\" tabindex=\"0\">try to wait untill the lights come back on</a></p>",
		'passages': {
		},
	},
	'death1': {
		'text': "<p>As you approach the monster to tail it, it begins walking towards you while speaking. <br>\nHow it speaks without a mouth isn&#39;t known to you <br>\n&quot;Please exit the store&quot; It says, while coming quickly towards you. <br>\n&quot;Please exit the store&quot; It says, while being one step from you.<br>\n&quot;Please exit the store&quot; It says, while punching you and trying to rip you apart.<br>\n<a class=\"squiffy-link link-passage\" data-passage=\"fight back\" role=\"link\" tabindex=\"0\">fight back</a></p>",
		'passages': {
			'fight back': {
				'text': "<p>You are no match against a 7ft faceless giant. It rips you on the spot. The last words you hear <br>\n&quot;Please ex-..&quot; <br>\n&quot;Thank you for coming. Please come again&quot; <br>\n<img src=\"https://i.imgur.com/58pmrQC.png\" alt=\"ImageTitle\"> <br>\n<a class=\"squiffy-link link-section\" data-section=\"Start\" role=\"link\" tabindex=\"0\">You died... But what if you could try again?</a></p>",
			},
		},
	},
	'talk1': {
		'text': "<p>Hello! Bonjour! Guten Morgen! Hallo! Dzień Dobry!<br>\n....<br>\nWhat are you even trying to do? Communicate with a monster that doesn&#39;t even have ears? <br>Does it even know that you&#39;re there, without having eyes or ears? <br>\nYou can <a class=\"squiffy-link link-section\" data-section=\"follow3008\" role=\"link\" tabindex=\"0\">follow it</a> or <a class=\"squiffy-link link-section\" data-section=\"lightoff\" role=\"link\" tabindex=\"0\">walk off</a>, hoping to not come across it anymore.</p>",
		'passages': {
		},
	},
	'lightoff': {
		'text': "<p>While walking through the bedroom section, you hear an electrical zap, and the lights flicker off. Scared you a lot. Well, on good luck you were in the bedroom section. You decide to find a comfy bed and sleep. You&#39;re quite hungry. <br>\nYou lay down and <a class=\"squiffy-link link-section\" data-section=\"day2a\" role=\"link\" tabindex=\"0\">sleep</a></p>",
		'passages': {
		},
	},
	'Flee': {
		'text': "<p>You booked it, what else can you do when you spot a 7ft monster? You&#39;re not sure if it&#39;s agressive, do you <a class=\"squiffy-link link-section\" data-section=\"follow3008\" role=\"link\" tabindex=\"0\">follow it</a> or do you <a class=\"squiffy-link link-section\" data-section=\"food\" role=\"link\" tabindex=\"0\">try to find something to eat</a>, as you haven&#39;t had anything in a few hours. They sold meatballs at IKEA, right?</p>",
		'passages': {
		},
	},
	'food': {
		'text': "<p>Deciding that food is more important that monsters, and you wanna sample the IKEA cuisine.<br>\n<br>\nWait, would the restaurant even serve fresh food?\n<br>\nYou sure hope so. <br>\nWalking around you find a <a class=\"squiffy-link link-section\" data-section=\"restaurant\" role=\"link\" tabindex=\"0\">restaurant</a></p>",
		'passages': {
		},
	},
	'restaurant': {
		'text': "<p>You decide to look inside, hopefully finding some good Swedish meatballs. Right after you do, the lights go off, accompanied by a strong electrical buzz.<br>\nBy some sort of miracle, there is a lot of food there. Still warm, almost if made a few minutes ago. No clue who would have made it, maybe the weird monster has some cook friends. <br>\nYou are surpised on how calm you are, stuck in an (as far as eye can see) infinite IKEA, trapped with some sort of monsters that don&#39;t have faces. <br>\nThere should be enough food here for atleast a few months, so you decide to drag a bed from the bedroom section not too far from here into this restaurant, and hope that someone will come to rescue you. You really hope someone notices that you&#39;re gone. <br>\n<a class=\"squiffy-link link-section\" data-section=\"day2b\" role=\"link\" tabindex=\"0\">Let&#39;s hit the sack for today</a></p>",
		'passages': {
		},
	},
	'sit down': {
		'text': "<p>You plop down, deciding that it&#39;s better to wait untill someone comes to you. You just wanted a table, why did you have to get lost in an IKEA. You have been here for 3 hours already. You&#39;re beginning to be a bit peckish. You&#39;re sitting down, waiting for someone to come. <br>\n<br>\n<a class=\"squiffy-link link-section\" data-section=\"No one's coming\" role=\"link\" tabindex=\"0\">No one&#39;s coming</a></p>",
		'passages': {
		},
	},
	'No one\'s coming': {
		'text': "<p>You check your phone, seeing that it&#39;s 9PM, you decide to walk a bit, it&#39;ll be closing time soon. You walk and walk, and come by a <a class=\"squiffy-link link-section\" data-section=\"restaurant\" role=\"link\" tabindex=\"0\">restaurant</a></p>",
		'passages': {
		},
	},
	'day2a': {
		'text': "<p>You wake up, the lights are on already. Phew. <br>\nYou are hungry. You know they have restaurants in IKEA, but would they be stocked in this weird place? <br>\nWell, a lot of things aren&#39;t normal here. A resuppling restaurant wouldn&#39;t be too out of the ordinary...  <br>\nYou could <a class=\"squiffy-link link-section\" data-section=\"findrestaurant\" role=\"link\" tabindex=\"0\">try to find one</a>, or you could <a class=\"squiffy-link link-section\" data-section=\"badidea\" role=\"link\" tabindex=\"0\">try to find and follow those staff members</a>...</p>",
		'passages': {
		},
	},
	'badidea': {
		'text': "<p>You walk a bit, hoping to find one of those faceless monsters. By a stroke of luck, you find one. <br>\nYou walk behind him, hoping to be followed to someone, or something. <br>\nYou walk right behing him, so you don&#39;t lose him. <br>\nWalking and walking <br>\nWalking around for a very long time now. You&#39;re tired. Hungry. Thristy. <br>\nLuckily, by some stroke of luck, or maybe because the monster was feeling remorseful, you stumble on a restaurant. <br>\nYou go inside, the monster sticks around outside. <br>\nYou eat and drink your full, and take some more for the future. <br>\nThe monster is still near the entrance, and you think it&#39;s waiting for you.  <br>\nWithout knowing if it understands you, you talk to it, and thank it.\nA sudden <a class=\"squiffy-link link-section\" data-section=\"death3\" role=\"link\" tabindex=\"0\">zap</a>, like the one from last night makes you jump. The monster starts walking towards you.</p>",
		'passages': {
		},
	},
	'death3': {
		'text': "<p>&quot;Please exit the store&quot; It says, while coming quickly towards you. <br>\n&quot;Please exit the store&quot; It says, while being one step from you.<br>\n&quot;Please exit the store&quot; It says, while punching you and trying to rip you apart.<br>\n<a class=\"squiffy-link link-passage\" data-passage=\"fight back\" role=\"link\" tabindex=\"0\">fight back</a></p>",
		'passages': {
			'fight back': {
				'text': "<p>You are no match against a 7ft faceless giant. It rips you on the spot. The last words you hear <br>\n&quot;Please ex-..&quot; <br>\n&quot;Thank you for coming. Please come again&quot; <br>\n<img src=\"https://i.imgur.com/Otacw3T.jpg\" alt=\"ImageTitle\"> <br>\n<a class=\"squiffy-link link-section\" data-section=\"Start\" role=\"link\" tabindex=\"0\">You died... But what if you could try again?</a></p>",
			},
		},
	},
	'findrestaurant': {
		'text': "<p>You pick a direction and go, with a rumble in your stomach and a dry mouth. <br>\n<a class=\"squiffy-link link-section\" data-section=\"north\" role=\"link\" tabindex=\"0\">go north,</a> or <a class=\"squiffy-link link-section\" data-section=\"west\" role=\"link\" tabindex=\"0\">go west</a>...</p>",
		'passages': {
		},
	},
	'west': {
		'text': "<p>You go west. <br>\nYou walk a bit.<br>\nWalk a bit more.<br>\nA certain smells tickles your nose..<br>\nSmells like the meatballs your mother always made....<br>\nYou follow the scent, and you <a class=\"squiffy-link link-section\" data-section=\"restaurant\" role=\"link\" tabindex=\"0\">find a restaurant</a></p>",
		'passages': {
		},
	},
	'north': {
		'text': "<p>You pick north, hoping to find a restaurant. <br>\nAnd you walk... <br>\nAnd walk... <br>\nAnd walk... <br>\nAnd walk... <br>\nEventually, you become tired, you walked for long and didn&#39;t drink anything in a long time<br>\nDo you <a class=\"squiffy-link link-passage\" data-passage=\"keep walking\" role=\"link\" tabindex=\"0\">keep walking</a> or try to <a class=\"squiffy-link link-section\" data-section=\"death2\" role=\"link\" tabindex=\"0\">rest</a>?</p>",
		'passages': {
			'keep walking': {
				'text': "<p>You try to walk a bit more, but exhaustion trumps your will..</p>",
			},
		},
	},
	'death2': {
		'text': "<p>You sit down on the nearest chair and close your eyes, <a class=\"squiffy-link link-section\" data-section=\"death2a\" role=\"link\" tabindex=\"0\">never to awaken again</a></p>",
		'passages': {
		},
	},
	'death2a': {
		'text': "<p>You have died from a combination of tiredness, hunger and thirst. Water is your first priority in any survival situation<br>\n<a class=\"squiffy-link link-section\" data-section=\"Start\" role=\"link\" tabindex=\"0\">But what if you could reverse your mistakes?</a></p>",
		'passages': {
		},
	},
	'day2b': {
		'text': "<p>The are humans here!<br>\nYou were woken up by a group of three.<br>\nThey asked you if you were from a town around here.<br>\nThere are <b>entire towns</b> here! <br>\nThey are suprised that you survived all on your own here, apperently those monsters, who are called &quot;staff&quot; by those in here, turn murderous at night.<br>\nFood gets restocked irregularly, so every town sends a few of their people to check<br>\nYou were quite lucky for not being ripped to shreds by one, apperently.<br>\nThey ask you to <a class=\"squiffy-link link-section\" data-section=\"follow them into town\" role=\"link\" tabindex=\"0\">follow them into town</a></p>",
		'passages': {
		},
	},
	'follow them into town': {
		'text': "<p>You follow them into a town called &quot;Bedrooms&quot;.<br>\nApperently all the towns here are called by what the abovehead signs say.<br>\nThe town is more like a fort, made out of wooden planks. <br>\n<img src=\"https://i.imgur.com/9uNj6Wk.jpg\" alt=\"ImageTitle\"> <br>\nThere are around 40 people in this town alone, and asking around you get 8 more towns. The closest one is called &quot;exchange&quot; and people come regulary to trade and exchange for things they need. <br>\nAsking around for how long people have been here, what wasn&#39;t a good idea in hindsight, people tell you a lot of different times. The latest one was Leila, and she says she was here for four weeks, the oldest one you got, was from a guy called Jared. He swears he has been here more than ten years. <br>\nApperently some people have seen the exit, and some have even exited the store, which you should take with a grain of salt, but generally everyone knows that if you came here, you&#39;re stuck here for life.\nThe staff attack the town a few times a week, but you&#39;re generally safe, and accepting that you won&#39;t ever go back to the outside, you live out your days, in this perfectly normal, regular old IKEA. <br> <a class=\"squiffy-link link-section\" data-section=\"end\" role=\"link\" tabindex=\"0\">This is the end</a></p>",
		'passages': {
		},
	},
	'end': {
		'text': "<p> <a class=\"squiffy-link link-section\" data-section=\"Start\" role=\"link\" tabindex=\"0\">Maybe you need to die a bit more often</a>?\n{if seen end:You have made first step}{else:how would you even not see the fuckign thing youre litearly right here}.\n{if seen death1: @set 1}{else:You need to die a bit more}. <br>\n{if seen death2a: @set 2}{else:You need to die a bit more}. <br>\n{if seen death3a: @set 3}{else:You need to die a bit more}. <br>\n{if 1=true, 2=true, 3=true:You have found the <a class=\"squiffy-link link-section\" data-section=\"exitexit\" role=\"link\" tabindex=\"0\">exitexit</a>}</p>",
		'passages': {
		},
	},
	'exitexit': {
		'text': "<p>You smell the air, a cold wind flies over your back. <br>\n&quot;A civillian has been seen exiting SCP-3008-1, commence capturing&quot; <br>\n......<br>\n<a class=\"squiffy-link link-section\" data-section=\"trueend\" role=\"link\" tabindex=\"0\"><em>oh fuc-</em></a></p>",
		'passages': {
		},
	},
	'trueend': {
		'text': "<p>You have completed the secret ending. What will happen you now? <br></p>",
		'passages': {
		},
	},
}
})();