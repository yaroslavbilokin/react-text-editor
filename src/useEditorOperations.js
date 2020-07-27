import { jsx } from 'slate-hyperscript'
import escapeHtml from 'escape-html'
import { Text } from 'slate'
import { Editor, Transforms } from 'slate'

const LIST_TYPES = ['numbered-list', 'bulleted-list']

const useEditorOperations = () => {
    const deserializeHTML = (html) => {
        const document = new DOMParser().parseFromString(html, 'text/html')
        const deserialize = (el) => {
            const TEXT_TAGS = {
                CODE: () => ({ code: true }),
                DEL: () => ({ strikethrough: true }),
                B: () => ({ bold: true }),
                EM: () => ({ italic: true }),
                I: () => ({ italic: true }),
                S: () => ({ strikethrough: true }),
                STRONG: () => ({ bold: true }),
                U: () => ({ underlined: true })
            };
            const ELEMENT_TAGS = {
                P: () => ({ type: "paragraph" }),
                H1: () => ({ type: "heading-one" }),
                H2: () => ({ type: "heading-two" }),
                BLOCKQUOTE: () => ({ type: "quote" }),
                LI: () => ({ type: "list-item" }),
                OL: () => ({ type: "numbered-list" }),
                UL: () => ({ type: "bulleted-list" }),
                LINK: el => ({ type: "link", url: el.getAttribute("href") }),
                IMG: el => ({ type: "image", url: el.getAttribute("src") })
            };

            if (el.nodeType === 3) {
                return el.textContent;
            }
            if (el.nodeType !== 1) {
                return null;
            }
            if (el.nodeName === "BR") {
                return "\n";
            }

            const { nodeName } = el;
            let parent = el;

            if (
                nodeName === "PRE" &&
                el.childNodes[0] &&
                el.childNodes[0].nodeName === "CODE"
            ) {
                [parent] = el.childNodes;
            }

            const children = Array.from(parent.childNodes).map(deserialize).flat();

            if (el.nodeName === "BODY") {
                return jsx("fragment", children);
            }

            if (ELEMENT_TAGS[nodeName]) {
                const attrs = ELEMENT_TAGS[nodeName](el);

                return jsx(
                    "element",
                    attrs,
                    children.length > 0 ? children : [{ text: "" }]
                );
            }

            if (TEXT_TAGS[nodeName]) {
                const attrs = TEXT_TAGS[nodeName](el);
                return children.map(child => jsx("text", attrs, child));
            }

            return children.length > 0 ? children : [{ text: "" }];
        };
        return deserialize(document.body)
    }

    const serializeToHTML = (value) => {
        const serialize = (node) => {
            if (Text.isText(node)) {
                return escapeHtml(node.text)
            }
            const children = node.children.map(n => {
                if (n.bold) {
                    return `<b>${n.text}</b>`
                }

                if (n.italic) {
                    return `<em>${n.text}</em>`
                }

                if (n.code) {
                    return `<code>${n.text}</code>`
                }

                if (n.underline) {
                    return `<u>${n.text}</u>`
                }
                return serialize(n);
            }
            ).join('')

            switch (node.type) {
                case 'block-quote':
                    return `<blockquote>${children}</blockquote>`
                case 'bulleted-list':
                    return `<ul>${children}</ul>`
                case 'heading-one':
                    return `<h1>${children}</h1>`
                case 'heading-two':
                    return `<h2>${children}</h2>`
                case 'list-item':
                    return `<li>${children}</li>`
                case 'numbered-list':
                    return `<ol>${children}</ol>`
                case 'paragraph':
                    return `<p>${children}</p>`
                default:
                    return children
            }
        }
        const nodes = {
            children: [...value]
        }
        return serialize(nodes)
    }

    const toggleBlock = (editor, format) => {
        const isActive = isBlockActive(editor, format)
        const isList = LIST_TYPES.includes(format)

        Transforms.unwrapNodes(editor, {
            match: n => LIST_TYPES.includes(n.type),
            split: true,
        })

        Transforms.setNodes(editor, {
            type: isActive ? 'paragraph' : isList ? 'list-item' : format,
        })

        if (!isActive && isList) {
            const block = { type: format, children: [] }
            Transforms.wrapNodes(editor, block)
        }
    }

    const isBlockActive = (editor, format) => {
        const [match] = Editor.nodes(editor, {
            match: n => n.type === format,
        })

        return !!match
    }

    const toggleMark = (editor, format) => {
        const isActive = isMarkActive(editor, format)

        if (isActive) {
            Editor.removeMark(editor, format)
        } else {
            Editor.addMark(editor, format, true)
        }
    }

    const isMarkActive = (editor, format) => {
        const marks = Editor.marks(editor)
        return marks ? marks[format] === true : false
    }

    return {
        deserializeHTML,
        serializeToHTML,
        isBlockActive,
        toggleBlock,
        toggleMark,
        isMarkActive
    }
}

export default useEditorOperations;