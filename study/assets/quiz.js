(() => {
  const cardsRoot = document.querySelector('[data-quiz-cards]');
  if (!cardsRoot) return;

  const allCards = [...cardsRoot.querySelectorAll('[data-quiz-question]')];
  const category = document.querySelector('[data-quiz-category]');
  const scoreElement = document.querySelector('[data-quiz-score]');
  const remainingElement = document.querySelector('[data-quiz-remaining]');
  const progressBar = document.querySelector('[data-quiz-progress-bar]');
  const complete = document.querySelector('[data-quiz-complete]');
  const summary = document.querySelector('[data-quiz-summary]');
  const retryWrong = document.querySelector('[data-quiz-retry-wrong]');
  let questions = [];
  let wrong = [];
  let currentIndex = 0;
  let score = 0;
  let answered = 0;

  const normalize = (value) => value
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/(?<=[가-힣])\s+(?=[가-힣])/g, '')
    .toLocaleLowerCase('ko');
  const answerDisplayKey = (value) => normalize(value).replace(/\(\)$/, '');
  const displayAnswers = (answers) => answers.filter((answer, index) => (
    answers.findIndex((candidate) => answerDisplayKey(candidate) === answerDisplayKey(answer)) === index
  ));
  const shuffle = (items) => {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  };

  function resetCard(card) {
    const form = card.querySelector('[data-quiz-form]');
    const input = card.querySelector('[data-quiz-answer]');
    const result = card.querySelector('[data-quiz-result]');
    const next = card.querySelector('[data-quiz-next]');
    form.querySelector('button').disabled = false;
    input.disabled = false;
    input.value = '';
    result.hidden = true;
    result.className = 'study-quiz-result';
    result.textContent = '';
    next.hidden = true;
    card.hidden = true;
  }

  function updateProgress() {
    const total = questions.length;
    scoreElement.textContent = String(score);
    remainingElement.textContent = String(Math.max(0, total - answered));
    progressBar.style.width = `${total ? answered / total * 100 : 0}%`;
  }

  function showQuestion() {
    allCards.forEach((card) => { card.hidden = true; });
    if (currentIndex >= questions.length) {
      complete.hidden = false;
      summary.textContent = `${questions.length}문제 중 ${score}문제를 맞혔습니다.`;
      retryWrong.hidden = wrong.length === 0;
      return;
    }
    complete.hidden = true;
    const card = questions[currentIndex];
    card.hidden = false;
    card.querySelector('[data-quiz-position]').textContent = `${currentIndex + 1} / ${questions.length}`;
    card.querySelector('[data-quiz-answer]').focus();
  }

  function start(items) {
    allCards.forEach(resetCard);
    questions = shuffle(items);
    wrong = [];
    currentIndex = 0;
    score = 0;
    answered = 0;
    updateProgress();
    showQuestion();
  }

  allCards.forEach((card) => {
    const form = card.querySelector('[data-quiz-form]');
    const input = card.querySelector('[data-quiz-answer]');
    const result = card.querySelector('[data-quiz-result]');
    const next = card.querySelector('[data-quiz-next]');
    const answers = JSON.parse(card.dataset.answers);
    const answerText = displayAnswers(answers).join(' 또는 ');

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (input.disabled || !input.value.trim()) return;
      const correct = answers.some((answer) => normalize(answer) === normalize(input.value));
      answered += 1;
      if (correct) score += 1;
      else wrong.push(card);
      result.classList.add(correct ? 'is-correct' : 'is-wrong');
      result.textContent = correct ? `정답입니다. ${answerText}` : `정답: ${answerText}`;
      result.hidden = false;
      input.disabled = true;
      form.querySelector('button').disabled = true;
      next.textContent = currentIndex === questions.length - 1 ? '결과 보기' : '다음 문제';
      next.hidden = false;
      updateProgress();
      next.focus();
    });

    next.addEventListener('click', () => {
      currentIndex += 1;
      showQuestion();
    });
  });

  const selectedCards = () => allCards.filter((card) => !category.value || card.dataset.category === category.value);
  category?.addEventListener('change', () => start(selectedCards()));
  document.querySelectorAll('[data-quiz-restart]').forEach((button) => button.addEventListener('click', () => start(selectedCards())));
  retryWrong?.addEventListener('click', () => start(wrong));
  start(selectedCards());
})();
