import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { TodosService } from './todos.service.js';
import { CreateTodoDto } from './dto/create-todo.dto.js';

// A controller's only job is routing: map an HTTP method + path to a handler method,
// pull data out of the request (@Body, @Param, @Query), and hand it off to the
// service. Notice there's no logic here — no array manipulation, no business rules.
// If you ever find yourself writing an `if` statement in a controller that isn't
// about the HTTP layer itself (status codes, auth guards), that logic belongs in
// the service instead.
@Controller('todos')
export class TodosController {
  // This is dependency injection: NestJS sees `TodosService` in the constructor's
  // type, looks it up in its DI container (it knows about TodosService because
  // TodosModule below declares it as a provider), and passes in the *same instance*
  // every time this controller is constructed. You never write `new TodosService()`
  // yourself — NestJS wires it up.
  constructor(private readonly todosService: TodosService) {}

  @Get()
  findAll() {
    return this.todosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.todosService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateTodoDto) {
    return this.todosService.create(dto);
  }

  @Patch(':id/toggle')
  toggle(@Param('id') id: string) {
    return this.todosService.toggle(id);
}

  @Delete(':id')
  remove(@Param('id') id: string) {
    this.todosService.remove(id);
    return { success: true };
  }
}
