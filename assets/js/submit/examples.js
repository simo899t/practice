/** The example files on the Add a test page, one per question type. */

export const EXAMPLES = [
  {
    format: 'single',
    file: 'examples/multiple-choice.md',
    about:
      'Each option is a list item: [x] marks the right one and [ ] the others. ' +
      'A quoted line under an option is its note, shown after answering.',
  },
  {
    format: 'group',
    file: 'examples/true-false.md',
    about:
      'Each statement is marked [true] or [false] ([yes]/[no] works too). ' +
      'Maths goes between dollar signs, written as in LaTeX.',
  },
  {
    format: 'open',
    file: 'examples/written-answer.md',
    about:
      'Lines starting with > are the setup, shown above the question. The model answer goes ' +
      'under ### Answer. Figures sit in an assets folder next to the test file.',
  },
];
