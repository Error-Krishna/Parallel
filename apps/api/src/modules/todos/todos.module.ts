import { Module } from '@nestjs/common';
import { TodosController } from './todos.controller.js';
import { TodosService } from './todos.service.js';

// A module is just a declaration: "these controllers exist, these providers
// (services) exist, and here's how they relate." NestJS reads @Module() metadata
// to build its dependency injection graph — this is the piece that makes the
// constructor injection in TodosController actually work: without TodosService
// listed here as a `provider`, NestJS wouldn't know how to construct one.
//
// DISPOSABLE — this whole module exists only as a hands-on way to learn the
// module/controller/service/DI pattern before touching the real, Prisma-backed
// feature modules (auth, parallels, quests, ...). Delete this folder and its
// import in app.module.ts once the pattern feels natural.
@Module({
  controllers: [TodosController],
  providers: [TodosService],
})
export class TodosModule {}
