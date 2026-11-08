import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';
/** The route needs no login (register, login, refresh, logout). Every other route does. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
