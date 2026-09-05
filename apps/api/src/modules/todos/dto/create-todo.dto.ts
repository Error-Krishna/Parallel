import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// A DTO (Data Transfer Object) describes the *shape* of an incoming request body.
// class-validator decorators turn this into a runtime check: NestJS's global
// ValidationPipe (registered in main.ts) rejects any request that doesn't match this
// shape *before* it ever reaches the controller method. You get validation for free
// just by typing the controller parameter as this class.
export class CreateTodoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;
}
