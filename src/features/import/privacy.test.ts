import { expect, test } from 'vitest'
import { maskSensitiveText } from './privacy'

test('masks phone numbers and address labels before analysis', () => {
  expect(maskSensitiveText('张女士 13812345678 上海市静安区南京西路100号')).toBe('张** 138****5678 [地址已隐藏]')
})

test('masks an ordinary name before a phone number and an address without 市', () => {
  expect(maskSensitiveText('联系人 王小明 13912345678 地址：静安区南京西路100号'))
    .toBe('联系人 王** 139****5678 地址：[地址已隐藏]')
})

test('masks unlabeled names before phones and common address spans', () => {
  expect(maskSensitiveText('王小明 13912345678 静安区南京西路100号')).toBe('王** 139****5678 [地址已隐藏]')
})

test('does not mask ordinary business text that resembles an address marker', () => {
  expect(maskSensitiveText('尺码区别太大')).toBe('尺码区别太大')
})
