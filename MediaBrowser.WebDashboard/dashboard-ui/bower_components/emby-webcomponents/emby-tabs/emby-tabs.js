﻿define(['dom', 'scroller', 'browser', 'layoutManager', 'focusManager', 'registerElement', 'css!./emby-tabs', 'scrollStyles'], function (dom, scroller, browser, layoutManager, focusManager) {
    'use strict';

    var EmbyTabs = Object.create(HTMLDivElement.prototype);
    var buttonClass = 'emby-tab-button';
    var activeButtonClass = buttonClass + '-active';

    function getBoundingClientRect(elem) {

        // Support: BlackBerry 5, iOS 3 (original iPhone)
        // If we don't have gBCR, just use 0,0 rather than error
        if (elem.getBoundingClientRect) {
            return elem.getBoundingClientRect();
        } else {
            return { top: 0, left: 0 };
        }
    }

    function animtateSelectionBar(bar, start, pos, duration, onFinish) {

        var endTransform = pos ? ('translateX(' + Math.round(pos) + 'px)') : 'none';
        var startTransform = start ? ('translateX(' + Math.round(start) + 'px)') : 'none';

        if (!duration || !bar.animate) {
            bar.style.transform = endTransform;
            if (onFinish) {
                onFinish();
            }
            return;
        }

        bar.style.transform = startTransform;

        var keyframes = [
          { transform: 'translateX(' + start + 'px)', offset: 0 },
          { transform: endTransform, offset: 1 }];

        bar.animate(keyframes, {
            duration: duration,
            iterations: 1,
            easing: 'linear',
            fill: 'forwards'
        });

        // for some reason onFinish is not firing. temporary browser issue?
        setTimeout(onFinish, duration);
    }

    function moveSelectionBar(tabs, newButton, oldButton, animate) {

        var selectionBar = tabs.selectionBar;

        if (selectionBar) {
            selectionBar.style.width = newButton.offsetWidth + 'px';
            selectionBar.classList.remove('hide');
        }

        var tabsOffset = getBoundingClientRect(tabs);
        var startOffset = tabs.currentOffset || 0;

        if (oldButton) {
            if (tabs.scroller) {
                startOffset = tabs.scroller.getCenterPosition(oldButton);
            } else {
                startOffset = getBoundingClientRect(oldButton).left - tabsOffset.left;
            }
        }

        var endPosition;
        if (tabs.scroller) {
            endPosition = tabs.scroller.getCenterPosition(newButton);
        } else {
            var tabButtonOffset = getBoundingClientRect(newButton);
            endPosition = tabButtonOffset.left - tabsOffset.left;
        }

        var delay = animate ? 100 : 0;
        tabs.currentOffset = endPosition;

        var onAnimationFinish = function () {

            //if (tabs.getAttribute('data-selectionbar') !== 'false') {
            //    showButtonSelectionBar(newButton);
            //}
            newButton.classList.add(activeButtonClass);

            if (selectionBar) {
                selectionBar.classList.add('hide');
            }

        };

        if (selectionBar) {
            animtateSelectionBar(selectionBar, startOffset, endPosition, delay, onAnimationFinish);
        } else {
            onAnimationFinish();
        }
    }

    function getFocusCallback(tabs, e) {
        return function () {
            onClick.call(tabs, e);
        };
    }

    function onFocus(e) {

        if (layoutManager.tv) {

            if (this.focusTimeout) {
                clearTimeout(this.focusTimeout);
            }
            this.focusTimeout = setTimeout(getFocusCallback(this, e), 700);
        }
    }

    function onClick(e) {

        var tabs = this;

        var current = tabs.querySelector('.' + activeButtonClass);
        var tabButton = dom.parentWithClass(e.target, buttonClass);

        if (tabButton && tabButton !== current) {

            if (current) {
                current.classList.remove(activeButtonClass);
            }

            var previousIndex = current ? parseInt(current.getAttribute('data-index')) : null;

            moveSelectionBar(tabs, tabButton, current, true);
            var index = parseInt(tabButton.getAttribute('data-index'));

            tabs.dispatchEvent(new CustomEvent("beforetabchange", {
                detail: {
                    selectedTabIndex: index,
                    previousIndex: previousIndex
                }
            }));

            // If toCenter is called syncronously within the click event, it sometimes ends up canceling it
            setTimeout(function () {

                tabs.selectedTabIndex = index;

                tabs.dispatchEvent(new CustomEvent("tabchange", {
                    detail: {
                        selectedTabIndex: index,
                        previousIndex: previousIndex
                    }
                }));
            }, 120);

            if (tabs.scroller) {
                tabs.scroller.toCenter(tabButton, false);
            }

        }
    }

    function initScroller(tabs) {

        if (tabs.scroller) {
            return;
        }

        var contentScrollSlider = tabs.querySelector('.emby-tabs-slider');
        if (contentScrollSlider) {
            tabs.scroller = new scroller(tabs, {
                horizontal: 1,
                itemNav: 0,
                mouseDragging: 1,
                touchDragging: 1,
                slidee: contentScrollSlider,
                smart: true,
                releaseSwing: true,
                scrollBy: 200,
                speed: 120,
                elasticBounds: 1,
                dragHandle: 1,
                dynamicHandle: 1,
                clickBar: 1,
                hiddenScroll: true,

                // In safari the transform is causing the headers to occasionally disappear or flicker
                requireAnimation: !browser.safari
            });
            tabs.scroller.init();
        } else {
            tabs.classList.add('hiddenScrollX');
        }
    }

    function initSelectionBar(tabs) {

        if (!browser.animate) {
            return;
        }

        var contentScrollSlider = tabs.querySelector('.emby-tabs-slider');

        if (!contentScrollSlider) {
            return;
        }

        if (tabs.getAttribute('data-selectionbar') === 'false') {
            return;
        }

        var elem = document.createElement('div');
        elem.classList.add('emby-tabs-selection-bar');

        contentScrollSlider.appendChild(elem);
        tabs.selectionBar = elem;
    }

    EmbyTabs.createdCallback = function () {

        if (this.classList.contains('emby-tabs')) {
            return;
        }
        this.classList.add('emby-tabs');
        this.classList.add('focusable');

        dom.addEventListener(this, 'click', onClick, {
            passive: true
        });
        dom.addEventListener(this, 'focus', onFocus, {
            passive: true,
            capture: true
        });

        initSelectionBar(this);
    };

    EmbyTabs.focus = function () {

        var selected = this.querySelector('.' + activeButtonClass);

        if (selected) {
            focusManager.focus(selected);
        } else {
            focusManager.autoFocus(this);
        }
    };

    EmbyTabs.refresh = function () {

        if (this.scroller) {
            this.scroller.reload();
        }
    };

    EmbyTabs.attachedCallback = function () {

        initScroller(this);

        var current = this.querySelector('.' + activeButtonClass);
        var currentIndex = current ? parseInt(current.getAttribute('data-index')) : 0;

        var newTabButton = this.querySelectorAll('.' + buttonClass)[currentIndex];

        if (newTabButton) {
            moveSelectionBar(this, newTabButton, current, false);
        }
    };

    EmbyTabs.detachedCallback = function () {

        if (this.scroller) {
            this.scroller.destroy();
            this.scroller = null;
        }

        dom.removeEventListener(this, 'click', onClick, {
            passive: true
        });
        dom.removeEventListener(this, 'focus', onFocus, {
            passive: true,
            capture: true
        });
        this.selectionBar = null;
    };

    EmbyTabs.selectedIndex = function (selected, triggerEvent) {

        var tabs = this;

        if (selected == null) {

            return tabs.selectedTabIndex || 0;
        }

        var current = tabs.selectedIndex();

        tabs.selectedTabIndex = selected;

        var tabButtons = tabs.querySelectorAll('.' + buttonClass);

        if (current === selected || triggerEvent === false) {

            tabs.dispatchEvent(new CustomEvent("beforetabchange", {
                detail: {
                    selectedTabIndex: selected
                }
            }));
            tabs.dispatchEvent(new CustomEvent("tabchange", {
                detail: {
                    selectedTabIndex: selected
                }
            }));

            var currentTabButton = tabButtons[current];
            moveSelectionBar(tabs, tabButtons[selected], currentTabButton, false);

            if (current !== selected && currentTabButton) {
                currentTabButton.classList.remove(activeButtonClass);
            }

        } else {
            tabButtons[selected].click();
        }
    };

    EmbyTabs.triggerBeforeTabChange = function (selected) {

        var tabs = this;

        tabs.dispatchEvent(new CustomEvent("beforetabchange", {
            detail: {
                selectedTabIndex: tabs.selectedIndex()
            }
        }));
    };

    EmbyTabs.triggerTabChange = function (selected) {

        var tabs = this;

        tabs.dispatchEvent(new CustomEvent("tabchange", {
            detail: {
                selectedTabIndex: tabs.selectedIndex()
            }
        }));
    };

    document.registerElement('emby-tabs', {
        prototype: EmbyTabs,
        extends: 'div'
    });
});