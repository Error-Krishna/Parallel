import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { CreateTodoDto } from './dto/create-todo.dto.js';

export interface Todo {
  id: string;
  title: string;
  done: boolean;
  createdAt: Date;
}

// A service is where the actual logic and data access lives — NOT the controller.
// This one is disposable and deliberately simple: an in-memory array instead of
// Prisma, so you can see the module/controller/service/DI pattern without the
// database being another variable. @Injectable() is what makes NestJS's dependency
// injection container willing to construct this class and hand instances of it to
// anything that asks for it in a constructor (see TodosController below).
@Injectable()
export class TodosService {
  // In a real (Prisma-backed) service, this state would live in Postgres instead —
  // that's the only thing that changes when you move from this toy example to the
  // real `auth`/`parallels`/etc. modules. The shape of the class stays the same.
  private todos: Todo[] = [];

  findAll(): Todo[] {
    return this.todos;
  }

  findOne(id: string): Todo {
    const todo = this.todos.find((t) => t.id === id);
    if (!todo) {
      throw new NotFoundException(`Todo ${id} not found`);
    }
    return todo;
  }

  create(dto: CreateTodoDto): Todo {
    const todo: Todo = {
      id: randomUUID(),
      title: dto.title,
      done: false,
      createdAt: new Date(),
    };
    this.todos.push(todo);
    return todo;
  }

  toggle(id: string): Todo {
    const todo = this.findOne(id);
    todo.done = !todo.done;
    return todo;
  }

  remove(id: string): void {
    const before = this.todos.length;
    this.todos = this.todos.filter((t) => t.id !== id);
    if (this.todos.length === before) {
      throw new NotFoundException(`Todo ${id} not found`);
    }
  }
}
