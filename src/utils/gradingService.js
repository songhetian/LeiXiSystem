// src/utils/gradingService.js

/**
 * Simulates automatic grading for various question types.
 * This is a frontend utility for preliminary scoring or preparing data for a backend grading service.
 *
 * @param {Array} questions - An array of question objects, each containing id, type, correct_answer, options (for choice questions).
 * @param {Object} userAnswers - An object where keys are question IDs and values are user's answers.
 * @returns {Object} - An object containing total score, passed status, and detailed results per question.
 */
export const gradeExam = (questions, userAnswers) => {
  let totalScore = 0;
  let correctCount = 0;
  const detailedResults = {};

  questions.forEach(question => {
    const userAnswer = userAnswers[question.id];
    let isCorrect = false;
    let scoreEarned = 0;
    const questionScore = question.score || 0; // Assume each question has a score property

    switch (question.type) {
      case 'single_choice':
      case 'true_false':
        // For single choice and true/false, direct comparison
        isCorrect = (userAnswer === question.correct_answer);
        if (isCorrect) {
          scoreEarned = questionScore;
          correctCount++;
        }
        break;

      case 'multiple_choice':
        // For multiple choice, user answer must exactly match correct answer (sorted)
        const sortedUserAnswer = userAnswer ? userAnswer.split('').sort().join('') : '';
        const sortedCorrectAnswer = question.correct_answer ? question.correct_answer.split('').sort().join('') : '';
        isCorrect = (sortedUserAnswer === sortedCorrectAnswer);
        if (isCorrect) {
          scoreEarned = questionScore;
          correctCount++;
        } else if (userAnswer) {
          // Optional: partial credit for multiple choice
          // This is a simple example, more complex partial grading can be implemented
          const userChoices = new Set(userAnswer.split(''));
          const correctChoices = new Set(question.correct_answer.split(''));
          let partialCorrect = 0;
          userChoices.forEach(choice => {
            if (correctChoices.has(choice)) {
              partialCorrect++;
            }
          });
          // Deduct if user selected incorrect options
          const incorrectChoicesSelected = userChoices.size - partialCorrect;
          if (incorrectChoicesSelected === 0 && partialCorrect > 0) {
            scoreEarned = (partialCorrect / correctChoices.size) * questionScore;
          }
        }
        break;

      case 'fill_blank':
        // For fill-in-the-blank, keyword matching (case-insensitive, trim spaces)
        // Assuming correct_answer is a comma-separated string of keywords or exact answer
        if (userAnswer && question.correct_answer) {
          const userResponse = userAnswer.trim().toLowerCase();
          const correctKeywords = question.correct_answer.split(',').map(kw => kw.trim().toLowerCase());

          // Simple matching: if user response contains any of the keywords
          // More advanced: match multiple blanks, exact phrase, etc.
          isCorrect = correctKeywords.some(kw => userResponse.includes(kw));
          if (isCorrect) {
            scoreEarned = questionScore;
            correctCount++;
          }
        }
        break;

      case 'short_answer':
        // Short answer questions are typically manually graded
        isCorrect = null; // Mark as null for manual grading
        scoreEarned = null; // Score is null until manual grading
        break;

      default:
        isCorrect = null;
        scoreEarned = null;
        break;
    }

    totalScore += (scoreEarned !== null ? scoreEarned : 0); // Only add if not null (i.e., not manual grading)

    detailedResults[question.id] = {
      question_id: question.id,
      user_answer: userAnswer,
      correct_answer: question.correct_answer,
      is_correct: isCorrect,
      score_earned: scoreEarned,
      question_type: question.type,
      question_content: question.content,
    };
  });

  // Determine if passed (requires total_score and pass_score from exam object)
  // This utility doesn't have access to exam.pass_score, so it returns the score.
  // The passed status will be determined by the component using this utility.

  return {
    total_score: totalScore,
    correct_count: correctCount,
    total_questions: questions.length,
    detailed_results: detailedResults,
  };
};
