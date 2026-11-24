# ion202020 · Undo 실험실 (자료구조와 알고리즘 Lab 7)

빌드 과정 없는 정적 사이트입니다. `index.html`을 더블클릭하면 바로 열립니다.

## 기능: Stack으로 만든 Undo / Redo

"Undo 실험실"에서 코드로 생성한 합성 뇌 MRI에 편집(밝기, 블러, 경계 검출, 회전 등)을 적용할 수 있습니다.

- 편집: `undoStack.push({ 편집 이름, 편집 전 이미지 })`, `redoStack` 비우기
- 되돌리기: `undoStack.pop()`으로 꺼낸 이미지로 복원, 지금 이미지는 `redoStack.push`
- 다시 실행: `redoStack.pop()`으로 꺼낸 이미지로 복원, 지금 이미지는 `undoStack.push`
- 단축키: `Ctrl/⌘ + Z` 되돌리기, `Ctrl/⌘ + Shift + Z` 또는 `Ctrl + Y` 다시 실행
- 최대 50단계 (스냅샷 1장 ≈ 0.59 MB)

"성능 비교"의 측정 실행 버튼은 편집 20개를 해 둔 상태에서 마지막 1개를 되돌리는 시간을
(A) 스택 pop + 스냅샷 복원과 (B) 원본에서 19개를 다시 계산하는 방식으로 비교합니다.

## 파일 구조

```
index.html     페이지 구조와 소개 글
style.css      디자인
js/stack.js    Stack 클래스 (push / pop / peek, 크기 제한)
js/brain.js    합성 뇌 MRI 생성 (실제 환자 데이터 아님)
js/edits.js    이미지 편집 연산 (입력을 바꾸지 않고 새 이미지 반환)
js/app.js      Undo/Redo 동작, 화면 갱신, 성능 측정
```

## 수정할 곳

- GitHub 링크: `js/app.js` 맨 위 `SITE.githubUsername`에 아이디 입력

## 배포

Netlify Drop(https://app.netlify.com/drop)에 이 폴더(`index.html`이 있는 폴더)를 통째로 끌어다 놓습니다.
수정 후에는 기존 프로젝트 → Deploys에 같은 폴더를 다시 끌어다 놓으면 같은 주소가 갱신됩니다.
