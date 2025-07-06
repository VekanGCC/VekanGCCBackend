import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { User, UserSchema } from './models/user.model';
import { UserAddress, UserAddressSchema } from './models/user-address.model';
import { UserBankDetails, UserBankDetailsSchema } from './models/user-bank-details.model';
import { UserStatutoryCompliance, UserStatutoryComplianceSchema } from './models/user-statutory-compliance.model';
import { VendorRegistrationService } from './services/vendor-registration.service';
import { ClientRegistrationService } from './services/client-registration.service';
import { JwtService } from './services/jwt.service';
import { AuthController } from './controllers/auth.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserAddress.name, schema: UserAddressSchema },
      { name: UserBankDetails.name, schema: UserBankDetailsSchema },
      { name: UserStatutoryCompliance.name, schema: UserStatutoryComplianceSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    VendorRegistrationService,
    ClientRegistrationService,
    JwtService,
  ],
  exports: [
    VendorRegistrationService,
    ClientRegistrationService,
    JwtService,
  ],
})
export class AppModule {} 