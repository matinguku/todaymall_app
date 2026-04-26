import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { COLORS } from '../../../../../constants';
import type { SellerStackParamList } from '../../../../../types';
import SellerPageScreen from './SellerPageScreen';
import SellerTeamInfoScreen from './SellerTeamInfoScreen';
import SellerSalesRefundInfoScreen from './sellerSalesRefundInfoScreen';

const Stack = createStackNavigator<SellerStackParamList>();

const SellerInfoStackNavigator: React.FC = () => (
  <Stack.Navigator
    initialRouteName="SellerHome"
    screenOptions={{
      headerShown: false,
      cardStyle: { backgroundColor: COLORS.background },
    }}
  >
    <Stack.Screen name="SellerHome" component={SellerPageScreen} />
    <Stack.Screen name="SellerTeamInfo" component={SellerTeamInfoScreen} />
    <Stack.Screen name="SellerSalesRefundInfo" component={SellerSalesRefundInfoScreen} />
  </Stack.Navigator>
);

export default SellerInfoStackNavigator;
