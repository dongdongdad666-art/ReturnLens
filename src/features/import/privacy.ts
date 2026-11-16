export function maskSensitiveText(input: string) {
  return input
    .replace(/((?:联系人|收件人|姓名)[：:\s]*)([\u4e00-\u9fa5]{2,4})(?=[\s，,;；。]|$)/g, (_, label: string, name: string) => `${label}${name[0]}**`)
    .replace(/((?:联系人|收件人|姓名|客户|买家)[：:\s]*)([\u4e00-\u9fa5]{2,4})(?=\s*(?:1\d{10}|电话|手机号))/g, (_, label: string, name: string) => `${label}${name[0]}**`)
    .replace(/([\u4e00-\u9fa5])[\u4e00-\u9fa5]{1,3}(?=\s*1\d{10})/g, '$1**')
    .replace(/([\u4e00-\u9fa5])[\u4e00-\u9fa5]{0,2}(女士|先生)/g, '$1**')
    .replace(/(1\d{2})\d{4}(\d{4})/g, '$1****$2')
    .replace(/((?:收货)?地址[：:\s]*)[^\n，,;；]+/g, '$1[地址已隐藏]')
    .replace(/[\u4e00-\u9fa5]{2,}(?:(?:省|市|区|县|镇|街道)[\u4e00-\u9fa5]*(?:路|街|巷)|(?:路|街|巷))\d+号/g, '[地址已隐藏]')
}
