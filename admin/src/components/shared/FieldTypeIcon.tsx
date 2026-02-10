import {
  Link,
  List,
  Phone,
  Alien,
  Clock,
  Calendar,
  Upload,
  EyeStriked,
  Paragraph,
} from '@strapi/icons';
import {
  BlocksField,
  BooleanField,
  ComponentField,
  DateField,
  DynamicZoneField,
  EmailField,
  EnumerationField,
  JsonField,
  MarkdownField,
  MediaField,
  NumberField,
  PasswordField,
  RelationField,
  TextField,
  UidField,
} from '@strapi/icons/symbols';

interface FieldTypeIconProps {
  fiedlType: string;
  index?: number; // For testing purposes
}

const FieldTypeIcon = ({ fiedlType, index }: FieldTypeIconProps) => {
  // console.log(index, fiedlType); // For testing purposes
  const props = {
    width: 32,
    height: 'auto',
  };

  const icons = {
    text: <TextField {...props} />,
    boolean: <BooleanField {...props} />,
    number: <NumberField {...props} />,
    textarea: <BlocksField {...props} />,
    email: <EmailField {...props} />,
    phone: <Phone {...props} />,
    url: <Link {...props} />,
    password: <PasswordField {...props} />,
    select: <List {...props} />,
    checkbox: <Alien {...props} />,
    radio: <Alien {...props} />,
    date: <DateField {...props} />,
    time: <Clock {...props} />,
    datetime: <Calendar {...props} />,
    file: <Upload {...props} />,
    hidden: <EyeStriked {...props} />,
    heading: <Alien {...props} />,
    paragraph: <Paragraph {...props} />,
    divider: <Alien {...props} />,
  };

  const icon = icons[fiedlType as keyof typeof icons];

  return icon;
};

export default FieldTypeIcon;
