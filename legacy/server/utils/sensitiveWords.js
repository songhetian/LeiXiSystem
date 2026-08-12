// server/utils/sensitiveWords.js

const sensitiveWords = [
  'badword1',
  'badword2',
  'sensitivephrase',
  // Add more sensitive words/phrases here
];

function containsSensitiveWords(text) {
  if (!text) return false;
  const lowerCaseText = text.toLowerCase();
  for (const word of sensitiveWords) {
    if (lowerCaseText.includes(word)) {
      return true;
    }
  }
  return false;
}

module.exports = {
  sensitiveWords,
  containsSensitiveWords,
};
