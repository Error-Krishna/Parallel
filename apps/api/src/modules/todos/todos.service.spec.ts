import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TodosService } from './todos.service.js';

// A unit test for the service — this is where the actual logic lives, so this is
// what's worth testing (the controller has nothing to test; it's pure routing).
describe('TodosService', () => {
  let service: TodosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TodosService],
    }).compile();

    service = module.get(TodosService);
  });

  it('starts empty', () => {
    expect(service.findAll()).toEqual([]);
  });

  it('creates a todo', () => {
    const todo = service.create({ title: 'Learn NestJS modules' });
    expect(todo.title).toBe('Learn NestJS modules');
    expect(todo.done).toBe(false);
    expect(service.findAll()).toHaveLength(1);
  });

  it('toggles a todo', () => {
    const todo = service.create({ title: 'Ship the auth module' });
    const toggled = service.toggle(todo.id);
    expect(toggled.done).toBe(true);
  });

  it('throws when toggling a todo that does not exist', () => {
    expect(() => service.toggle('missing-id')).toThrow(NotFoundException);
  });

  it('removes a todo', () => {
    const todo = service.create({ title: 'Delete this module later' });
    service.remove(todo.id);
    expect(service.findAll()).toEqual([]);
  });
});
