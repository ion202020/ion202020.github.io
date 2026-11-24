/*
 * stack.js — Undo/Redo에 쓰는 Stack(스택) 자료구조
 *
 * 배열의 끝을 꼭대기(top)로 쓰는 배열 기반 스택입니다.
 *   push  : 꼭대기에 하나 올림        O(1)
 *   pop   : 꼭대기에서 하나 꺼냄      O(1)
 *   peek  : 꼭대기를 꺼내지 않고 봄   O(1)
 *
 * capacity를 정하면 "크기 제한 스택"이 됩니다. 가득 찬 상태에서 push하면
 * 가장 오래된 기록(바닥)을 버립니다. 이 경우에만 O(capacity)가 걸리는데,
 * 편집 기록마다 이미지 스냅샷을 들고 있어서 메모리를 무한정 쓰지 않으려고
 * 넣은 제한입니다. (대부분의 편집 프로그램도 Undo 횟수에 제한이 있습니다.)
 */
class Stack {
  constructor(capacity = Infinity) {
    this.items = []; // items[0] = 바닥(bottom), items[size - 1] = 꼭대기(top)
    this.capacity = capacity;
  }

  push(item) {
    if (this.items.length >= this.capacity) {
      this.items.shift(); // 가득 차면 가장 오래된 기록을 버림
    }
    this.items[this.items.length] = item;
  }

  pop() {
    if (this.isEmpty()) return undefined;
    const top = this.items[this.items.length - 1];
    this.items.length -= 1;
    return top;
  }

  peek() {
    return this.isEmpty() ? undefined : this.items[this.items.length - 1];
  }

  isEmpty() {
    return this.items.length === 0;
  }

  get size() {
    return this.items.length;
  }

  clear() {
    this.items.length = 0;
  }

  // 화면에 그리기 위한 복사본 (꼭대기부터 순서대로)
  toArrayTopFirst() {
    return this.items.slice().reverse();
  }
}
