document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 요소 캐싱 ---
    const textA = document.getElementById('text-a');
    const textB = document.getElementById('text-b');
    const compareBtn = document.getElementById('compare-btn');
    const resetBtn = document.getElementById('reset-btn');
    const inputSection = document.getElementById('input-section');
    const resultSection = document.getElementById('result-section');
    const diffOutput = document.getElementById('diff-output');
    const stats = {
        added: document.getElementById('lines-added'),
        removed: document.getElementById('lines-removed'),
        blocks: document.getElementById('block-changes'),
    };
    const viewModeToggle = document.getElementById('view-mode-toggle');
    const modeButtons = viewModeToggle.querySelectorAll('.mode-btn');

    // --- 상태 변수 ---
    let lastDiff = null;
    let currentMode = sessionStorage.getItem('diff-mode') || 'side-by-side';
    if (currentMode !== 'side-by-side' && currentMode !== 'inline') {
        currentMode = 'side-by-side';
    }

    // --- 비교 로직 ---
    const runComparison = () => {
        const oldText = textA.value;
        const newText = textB.value;
        
        if (oldText === '' && newText === '') {
            alert('비교할 텍스트를 입력해주세요.');
            return;
        }

        lastDiff = Diff.diffLines(oldText, newText);

        updateStats(lastDiff);
        renderDiff(lastDiff, currentMode);

        inputSection.classList.add('hidden');
        resultSection.classList.remove('hidden');
    };

    const updateStats = (diff) => {
        let added = 0;
        let removed = 0;
        let blocks = 0;
        diff.forEach(part => {
            if (part.added) {
                added += part.count;
                blocks++;
            }
            if (part.removed) {
                removed += part.count;
                if (!part.added) blocks++;
            }
        });
        stats.added.textContent = `+${added} 라인`;
        stats.removed.textContent = `-${removed} 라인`;
        stats.blocks.textContent = `↔ ${blocks} 블록`;
    };

    // --- 렌더링 로직 ---
    const renderDiff = (diff, mode) => {
        diffOutput.innerHTML = '';
        switch (mode) {
            case 'side-by-side':
                renderSideBySide(diff);
                break;
            case 'inline':
                renderInline(diff);
                break;
        }
        updateActiveModeButton(mode);
    };

    const renderSideBySide = (diff) => {
        const container = document.createElement('div');
        container.className = 'flex font-mono text-sm';
        const leftPane = document.createElement('div');
        leftPane.className = 'w-1/2 border-r border-gray-200';
        const rightPane = document.createElement('div');
        rightPane.className = 'w-1/2';

        let leftLineNum = 1;
        let rightLineNum = 1;
        
        const lineSplitter = (value) => value ? value.replace(/\n$/, "").split('\n') : [];

        const appendSideBySideLine = (type, leftText, rightText) => {
            const leftLineDiv = document.createElement('div');
            leftLineDiv.className = 'flex min-h-[20px]';
            const rightLineDiv = document.createElement('div');
            rightLineDiv.className = 'flex min-h-[20px]';

            const leftNumSpan = document.createElement('span');
            leftNumSpan.className = 'w-10 text-right pr-2 text-gray-500 select-none flex-shrink-0';
            const rightNumSpan = document.createElement('span');
            rightNumSpan.className = 'w-10 text-right pr-2 text-gray-500 select-none flex-shrink-0';

            const leftContentPre = document.createElement('pre');
            leftContentPre.className = 'flex-1 pl-2 pr-2 whitespace-pre-wrap break-all m-0';
            const rightContentPre = document.createElement('pre');
            rightContentPre.className = 'flex-1 pl-2 pr-2 whitespace-pre-wrap break-all m-0';

            if (type === 'equal') {
                leftNumSpan.textContent = leftLineNum++;
                rightNumSpan.textContent = rightLineNum++;
                leftContentPre.textContent = leftText;
                rightContentPre.textContent = rightText;
                leftLineDiv.classList.add('diff-line-equal');
                rightLineDiv.classList.add('diff-line-equal');
            } else if (type === 'removed') {
                leftNumSpan.textContent = leftLineNum++;
                leftContentPre.textContent = leftText;
                leftLineDiv.classList.add('diff-line-removed');
                rightLineDiv.classList.add('diff-line-placeholder');
            } else if (type === 'added') {
                rightNumSpan.textContent = rightLineNum++;
                rightContentPre.textContent = rightText;
                rightLineDiv.classList.add('diff-line-added');
                leftLineDiv.classList.add('diff-line-placeholder');
            } else if (type === 'modified') {
                leftNumSpan.textContent = leftLineNum++;
                rightNumSpan.textContent = rightLineNum++;
                leftLineDiv.classList.add('diff-line-removed');
                rightLineDiv.classList.add('diff-line-added');
                const charDiff = Diff.diffChars(leftText, rightText);
                charDiff.forEach(charPart => {
                    const span = document.createElement('span');
                    span.textContent = charPart.value;
                    if (charPart.added) {
                        span.className = 'char-added';
                        rightContentPre.appendChild(span);
                    } else if (charPart.removed) {
                        span.className = 'char-removed';
                        leftContentPre.appendChild(span);
                    } else {
                        leftContentPre.appendChild(span.cloneNode(true));
                        rightContentPre.appendChild(span.cloneNode(true));
                    }
                });
            }

            leftLineDiv.appendChild(leftNumSpan);
            leftLineDiv.appendChild(leftContentPre);
            rightLineDiv.appendChild(rightNumSpan);
            rightLineDiv.appendChild(rightContentPre);
            leftPane.appendChild(leftLineDiv);
            rightPane.appendChild(rightLineDiv);
        };

        for (let i = 0; i < diff.length; i++) {
            const part = diff[i];
            const nextPart = diff[i + 1];

            if (part.removed && nextPart && nextPart.added) {
                let removedLines = lineSplitter(part.value);
                let addedLines = lineSplitter(nextPart.value);

                while (removedLines.length > 0 && addedLines.length > 0 && removedLines[0] === addedLines[0]) {
                    const commonLine = removedLines.shift();
                    addedLines.shift();
                    appendSideBySideLine('equal', commonLine, commonLine);
                }

                const commonSuffix = [];
                while (removedLines.length > 0 && addedLines.length > 0 && removedLines[removedLines.length - 1] === addedLines[addedLines.length - 1]) {
                    const commonLine = removedLines.pop();
                    addedLines.pop();
                    commonSuffix.unshift(commonLine);
                }

                const maxLines = Math.max(removedLines.length, addedLines.length);
                for (let j = 0; j < maxLines; j++) {
                    const leftText = removedLines[j];
                    const rightText = addedLines[j];
                    if (leftText !== undefined && rightText !== undefined) {
                        appendSideBySideLine('modified', leftText, rightText);
                    } else if (leftText !== undefined) {
                        appendSideBySideLine('removed', leftText, null);
                    } else if (rightText !== undefined) {
                        appendSideBySideLine('added', null, rightText);
                    }
                }

                commonSuffix.forEach(line => {
                    appendSideBySideLine('equal', line, line);
                });

                i++;
            } else {
                const lines = lineSplitter(part.value);
                lines.forEach(line => {
                    if (part.added) {
                        appendSideBySideLine('added', null, line);
                    } else if (part.removed) {
                        appendSideBySideLine('removed', line, null);
                    } else {
                        appendSideBySideLine('equal', line, line);
                    }
                });
            }
        }
        container.appendChild(leftPane);
        container.appendChild(rightPane);
        diffOutput.appendChild(container);
    };

    const renderInline = (diff) => {
        const pre = document.createElement('pre');
        pre.className = 'p-4 font-mono text-sm whitespace-pre-wrap break-all m-0';
        const lineSplitter = (value) => value ? value.replace(/\n$/, "").split('\n') : [];

        const appendInlineSpan = (text, className) => {
            if (!text) return;
            const span = document.createElement('span');
            if (className) {
                span.className = className;
            }
            span.textContent = text;
            pre.appendChild(span);
        };

        for (let i = 0; i < diff.length; i++) {
            const part = diff[i];
            const nextPart = diff[i + 1];

            if (part.removed && nextPart && nextPart.added) {
                let removedLines = lineSplitter(part.value);
                let addedLines = lineSplitter(nextPart.value);

                while (removedLines.length > 0 && addedLines.length > 0 && removedLines[0] === addedLines[0]) {
                    appendInlineSpan(removedLines.shift() + '\n');
                    addedLines.shift();
                }

                const commonSuffix = [];
                while (removedLines.length > 0 && addedLines.length > 0 && removedLines[removedLines.length - 1] === addedLines[addedLines.length - 1]) {
                    commonSuffix.unshift(addedLines.pop());
                    removedLines.pop();
                }

                appendInlineSpan(removedLines.join('\n') + (removedLines.length > 0 ? '\n' : ''), 'diff-removed');
                appendInlineSpan(addedLines.join('\n') + (addedLines.length > 0 ? '\n' : ''), 'diff-added');
                
                appendInlineSpan(commonSuffix.join('\n') + (commonSuffix.length > 0 ? '\n' : ''));

                i++;
            } else {
                 appendInlineSpan(part.value, part.added ? 'diff-added' : part.removed ? 'diff-removed' : '');
            }
        }
        diffOutput.appendChild(pre);
    };

    const updateActiveModeButton = (mode) => {
        modeButtons.forEach(btn => {
            if (btn.dataset.mode === mode) {
                btn.classList.add('bg-blue-500', 'text-white');
            } else {
                btn.classList.remove('bg-blue-500', 'text-white');
            }
        });
        sessionStorage.setItem('diff-mode', mode);
    };

    // --- 이벤트 리스너 등록 ---
    compareBtn.addEventListener('click', runComparison);

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            runComparison();
        }
        if (resultSection.offsetParent !== null) {
            if (e.key === '1') {
                e.preventDefault();
                currentMode = 'side-by-side';
                renderDiff(lastDiff, currentMode);
            } else if (e.key === '2') {
                e.preventDefault();
                currentMode = 'inline';
                renderDiff(lastDiff, currentMode);
            }
        }
    });

    resetBtn.addEventListener('click', () => {
        resultSection.classList.add('hidden');
        inputSection.classList.remove('hidden');
        textA.value = '';
        textB.value = '';
        textA.focus();
    });

    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            currentMode = btn.dataset.mode;
            if (lastDiff) {
                renderDiff(lastDiff, currentMode);
            }
        });
    });
    
    // --- 초기화 ---
    updateActiveModeButton(currentMode);
    
});
